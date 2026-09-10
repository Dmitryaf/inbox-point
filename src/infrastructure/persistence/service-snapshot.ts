import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, rmSync } from 'node:fs';
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, parse, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { z } from 'zod';

import { isFileSystemError } from '@/infrastructure/file-system/local-state-file.js';
import {
  SqliteBackupService,
  verifySqliteBackup,
} from '@/infrastructure/persistence/sqlite-backup-service.js';
import { sqliteSchemaVersion } from '@/infrastructure/persistence/sqlite-schema.js';

const millisecondsPerDay = 24 * 60 * 60 * 1_000;
const snapshotDirectoryPattern = /^messenger-handoff-snapshot-.*$/;
const snapshotFileNames = [
  'database.sqlite',
  'content-settings.json',
  'service-control.json',
] as const;

const snapshotManifestSchema = z.object({
  closedRequestRetentionDays: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  files: z.array(
    z.object({
      name: z.enum(snapshotFileNames),
      sha256: z.string().regex(/^[a-f\d]{64}$/),
      size: z.number().int().nonnegative(),
    }),
  ),
  formatVersion: z.literal(1),
  secretsIncluded: z.literal(false),
  sqliteSchemaVersion: z.literal(sqliteSchemaVersion),
});

export type ServiceSnapshotManifest = z.infer<typeof snapshotManifestSchema>;

export interface ServiceSnapshot {
  createdAt: Date;
  manifest: ServiceSnapshotManifest;
  path: string;
}

export interface ServiceSnapshotServiceOptions {
  clock?: () => Date;
  createId?: () => string;
  retentionDays?: number;
  snapshotDirectory?: string;
}

export interface RestoredServiceSnapshot {
  contentSettingsPath?: string;
  databasePath: string;
  serviceControlPath?: string;
}

export class ServiceSnapshotService {
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly retentionDays: number;
  private readonly snapshotDirectory: string;

  public constructor(
    private readonly databasePath: string,
    options: ServiceSnapshotServiceOptions = {},
  ) {
    if (databasePath === ':memory:') {
      throw new Error('An in-memory service cannot be snapshotted');
    }
    this.clock = options.clock ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.retentionDays = options.retentionDays ?? 7;
    if (!Number.isInteger(this.retentionDays) || this.retentionDays < 1) {
      throw new Error('Snapshot retention days must be a positive integer');
    }
    this.snapshotDirectory =
      options.snapshotDirectory ?? join(dirname(databasePath), 'snapshots');
  }

  public async createSnapshot(): Promise<ServiceSnapshot> {
    const createdAt = this.clock();
    const timestamp = createdAt.toISOString().replaceAll(':', '-');
    const directoryName = `messenger-handoff-snapshot-${timestamp}-${this.createId()}`;
    const finalPath = join(this.snapshotDirectory, directoryName);
    const temporaryPath = finalPath + '.tmp';
    await mkdir(this.snapshotDirectory, { recursive: true, mode: 0o700 });
    await mkdir(temporaryPath, { mode: 0o700 });

    try {
      const backup = await new SqliteBackupService(this.databasePath, {
        backupDirectory: temporaryPath,
        clock: () => createdAt,
        createId: () => 'database',
        retentionDays: this.retentionDays,
      }).createBackup();
      await rename(backup.path, join(temporaryPath, 'database.sqlite'));
      await this.copyOptionalStateFiles(temporaryPath);
      const manifest = await createManifest(
        temporaryPath,
        createdAt,
        this.retentionDays,
      );
      await writeFile(
        join(temporaryPath, 'manifest.json'),
        JSON.stringify(manifest, undefined, 2) + '\n',
        { encoding: 'utf8', mode: 0o600 },
      );
      await verifyServiceSnapshot(temporaryPath);
      await rename(temporaryPath, finalPath);
      await this.deleteExpiredSnapshots(createdAt, finalPath);
      return { createdAt, manifest, path: finalPath };
    } catch (error: unknown) {
      await rm(temporaryPath, { force: true, recursive: true });
      throw error;
    }
  }

  private async copyOptionalStateFiles(targetDirectory: string): Promise<void> {
    const dataDirectory = dirname(this.databasePath);
    for (const fileName of snapshotFileNames.slice(1)) {
      try {
        const target = join(targetDirectory, fileName);
        await copyFile(join(dataDirectory, fileName), target);
        await chmod(target, 0o600);
      } catch (error: unknown) {
        if (!isFileSystemError(error) || error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  private async deleteExpiredSnapshots(
    now: Date,
    currentSnapshotPath: string,
  ): Promise<void> {
    const entries = await readdir(this.snapshotDirectory, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory() || !snapshotDirectoryPattern.test(entry.name)) {
        continue;
      }
      const path = join(this.snapshotDirectory, entry.name);
      if (resolve(path) === resolve(currentSnapshotPath)) {
        continue;
      }
      if ((await snapshotExpiration(path, this.retentionDays)) <= now) {
        await rm(path, { recursive: true });
      }
    }
  }
}

export async function verifyServiceSnapshot(
  snapshotPath: string,
): Promise<ServiceSnapshotManifest> {
  const entries = await readdir(snapshotPath, { withFileTypes: true });
  const allowedNames = new Set<string>([...snapshotFileNames, 'manifest.json']);
  if (
    entries.some((entry) => !entry.isFile() || !allowedNames.has(entry.name))
  ) {
    throw new Error('Service snapshot contains an unexpected file');
  }

  const parsed = snapshotManifestSchema.safeParse(
    JSON.parse(await readFile(join(snapshotPath, 'manifest.json'), 'utf8')),
  );
  if (!parsed.success) {
    throw new Error('Service snapshot manifest is invalid');
  }
  const names = parsed.data.files.map((file) => file.name);
  const manifestNames = new Set<string>(names);
  if (
    names[0] !== 'database.sqlite' ||
    names.length !== manifestNames.size ||
    entries.some(
      (entry) =>
        entry.name !== 'manifest.json' && !manifestNames.has(entry.name),
    )
  ) {
    throw new Error('Service snapshot manifest does not match its files');
  }

  for (const file of parsed.data.files) {
    const path = join(snapshotPath, file.name);
    const fileStat = await stat(path);
    if (fileStat.size !== file.size || (await sha256(path)) !== file.sha256) {
      throw new Error(`Service snapshot checksum failed for ${file.name}`);
    }
  }
  const database = parsed.data.files.find(
    (file) => file.name === 'database.sqlite',
  );
  if (!database) {
    throw new Error('Service snapshot does not contain a database');
  }
  verifySqliteBackup(join(snapshotPath, database.name));
  verifyRetentionApplied(
    join(snapshotPath, database.name),
    new Date(parsed.data.createdAt),
    parsed.data.closedRequestRetentionDays,
  );
  return parsed.data;
}

export async function restoreServiceSnapshot(
  snapshotPath: string,
  targetDirectory: string,
): Promise<RestoredServiceSnapshot> {
  const resolvedTarget = resolve(targetDirectory);
  if (resolvedTarget === parse(resolvedTarget).root) {
    throw new Error('Snapshot restore target must not be a filesystem root');
  }
  await assertTargetDoesNotExist(resolvedTarget);
  const manifest = await verifyServiceSnapshot(snapshotPath);
  await mkdir(resolvedTarget, { mode: 0o700 });

  try {
    const restored: RestoredServiceSnapshot = {
      databasePath: join(resolvedTarget, 'messenger-handoff.sqlite'),
    };
    for (const file of manifest.files) {
      const targetName =
        file.name === 'database.sqlite'
          ? basename(restored.databasePath)
          : file.name;
      const target = join(resolvedTarget, targetName);
      await copyFile(join(snapshotPath, file.name), target);
      await chmod(target, 0o600);
      if (file.name === 'content-settings.json') {
        restored.contentSettingsPath = target;
      } else if (file.name === 'service-control.json') {
        restored.serviceControlPath = target;
      }
    }
    verifySqliteBackup(restored.databasePath);
    return restored;
  } catch (error: unknown) {
    await rm(resolvedTarget, { recursive: true });
    throw error;
  }
}

async function createManifest(
  directory: string,
  createdAt: Date,
  retentionDays: number,
): Promise<ServiceSnapshotManifest> {
  const files: ServiceSnapshotManifest['files'] = [];
  for (const name of snapshotFileNames) {
    try {
      const path = join(directory, name);
      const fileStat = await stat(path);
      files.push({ name, sha256: await sha256(path), size: fileStat.size });
    } catch (error: unknown) {
      if (!isFileSystemError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return {
    closedRequestRetentionDays: retentionDays,
    createdAt: createdAt.toISOString(),
    expiresAt: calculateSnapshotExpiration(
      join(directory, 'database.sqlite'),
      createdAt,
      retentionDays,
    ).toISOString(),
    files,
    formatVersion: 1,
    secretsIncluded: false,
    sqliteSchemaVersion,
  };
}

function calculateSnapshotExpiration(
  databasePath: string,
  createdAt: Date,
  retentionDays: number,
): Date {
  const defaultExpiration =
    createdAt.getTime() + retentionDays * millisecondsPerDay;
  const database = new DatabaseSync(databasePath, {
    readOnly: true,
    timeout: 5_000,
  });
  try {
    const row = database
      .prepare(
        `SELECT MIN(request.closed_at) AS earliest_closed_at
         FROM support_requests AS request
         WHERE request.status = 'closed'
           AND request.closed_at IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM deliveries AS unfinished
             WHERE unfinished.request_id = request.id
               AND unfinished.status != 'sent'
           )
           AND (
             request.client_display_name IS NOT NULL
             OR EXISTS (
               SELECT 1 FROM conversation_messages AS message
               WHERE message.request_id = request.id
             )
             OR EXISTS (
               SELECT 1 FROM deliveries AS delivery
               WHERE delivery.request_id = request.id
                 AND delivery.status = 'sent'
                 AND delivery.text != ''
             )
           )`,
      )
      .get() as { earliest_closed_at: string | null };
    const earliestContentExpiration = row.earliest_closed_at
      ? new Date(row.earliest_closed_at).getTime() +
        retentionDays * millisecondsPerDay
      : defaultExpiration;
    return new Date(Math.min(defaultExpiration, earliestContentExpiration));
  } finally {
    database.close();
    rmSync(databasePath + '-shm', { force: true });
    rmSync(databasePath + '-wal', { force: true });
  }
}

async function snapshotExpiration(
  snapshotPath: string,
  retentionDays: number,
): Promise<Date> {
  try {
    const value = JSON.parse(
      await readFile(join(snapshotPath, 'manifest.json'), 'utf8'),
    ) as { expiresAt?: unknown };
    if (typeof value.expiresAt === 'string') {
      const timestamp = Date.parse(value.expiresAt);
      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp);
      }
    }
  } catch {
    // Fall back to directory age when a snapshot directory is incomplete.
  }
  return new Date(
    (await stat(snapshotPath)).mtimeMs + retentionDays * millisecondsPerDay,
  );
}

function verifyRetentionApplied(
  databasePath: string,
  createdAt: Date,
  retentionDays: number,
): void {
  const cutoff = new Date(
    createdAt.getTime() - retentionDays * millisecondsPerDay,
  ).toISOString();
  const database = new DatabaseSync(databasePath, {
    readOnly: true,
    timeout: 5_000,
  });
  try {
    const sensitive = database
      .prepare(
        `SELECT
          (
            SELECT COUNT(*)
            FROM conversation_messages AS message
            JOIN support_requests AS request ON request.id = message.request_id
            WHERE ${expiredEligibleRequestWhere()}
          ) AS messages,
          (
            SELECT COUNT(*)
            FROM deliveries AS delivery
            JOIN support_requests AS request ON request.id = delivery.request_id
            WHERE delivery.status = 'sent'
              AND delivery.text != ''
              AND ${expiredEligibleRequestWhere()}
          ) AS deliveries,
          (
            SELECT COUNT(*)
            FROM support_requests AS request
            WHERE request.client_display_name IS NOT NULL
              AND ${expiredEligibleRequestWhere()}
          ) AS names`,
      )
      .get(cutoff, cutoff, cutoff) as {
      deliveries: number;
      messages: number;
      names: number;
    };
    if (sensitive.deliveries + sensitive.messages + sensitive.names > 0) {
      throw new Error('Service snapshot contains content due for retention');
    }
  } finally {
    database.close();
    rmSync(databasePath + '-shm', { force: true });
    rmSync(databasePath + '-wal', { force: true });
  }
}

function expiredEligibleRequestWhere(): string {
  return `request.status = 'closed'
    AND request.closed_at IS NOT NULL
    AND request.closed_at <= ?
    AND NOT EXISTS (
      SELECT 1
      FROM deliveries AS unfinished
      WHERE unfinished.request_id = request.id
        AND unfinished.status != 'sent'
    )`;
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

async function assertTargetDoesNotExist(path: string): Promise<void> {
  try {
    await stat(path);
    throw new Error('Snapshot restore target already exists');
  } catch (error: unknown) {
    if (!isFileSystemError(error) || error.code !== 'ENOENT') {
      throw error;
    }
  }
}
