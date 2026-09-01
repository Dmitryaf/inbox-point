import { randomUUID } from 'node:crypto';
import { chmod, mkdir, rename, rm } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';

const requiredTables = [
  'deliveries',
  'message_links',
  'processed_events',
  'support_requests',
] as const;

export interface SqliteBackup {
  createdAt: Date;
  fileName: string;
  path: string;
}

export interface SqliteBackupServiceOptions {
  backupDirectory?: string;
  clock?: () => Date;
  createId?: () => string;
}

export class SqliteBackupService {
  private readonly backupDirectory: string;
  private readonly clock: () => Date;
  private readonly createId: () => string;

  public constructor(
    private readonly databasePath: string,
    options: SqliteBackupServiceOptions = {},
  ) {
    if (databasePath === ':memory:') {
      throw new Error('An in-memory database cannot be backed up');
    }
    this.backupDirectory =
      options.backupDirectory ?? join(dirname(databasePath), 'backups');
    this.clock = options.clock ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  public async createBackup(): Promise<SqliteBackup> {
    const createdAt = this.clock();
    const timestamp = createdAt.toISOString().replaceAll(':', '-');
    const fileName = `messenger-handoff-${timestamp}-${this.createId()}.sqlite`;
    const finalPath = join(this.backupDirectory, fileName);
    const temporaryPath = finalPath + '.tmp';
    assertPathInsideDirectory(temporaryPath, this.backupDirectory);
    await mkdir(this.backupDirectory, { recursive: true });

    const source = new DatabaseSync(this.databasePath, {
      readOnly: true,
      timeout: 5_000,
    });
    try {
      await backup(source, temporaryPath);
    } catch (error: unknown) {
      await rm(temporaryPath, { force: true });
      throw error;
    } finally {
      source.close();
    }

    try {
      verifySqliteBackup(temporaryPath);
      await rename(temporaryPath, finalPath);
      await chmod(finalPath, 0o600);
    } catch (error: unknown) {
      await rm(temporaryPath, { force: true });
      throw error;
    }

    return {
      createdAt,
      fileName: basename(finalPath),
      path: finalPath,
    };
  }
}

export function verifySqliteBackup(path: string): void {
  const database = new DatabaseSync(path, {
    readOnly: true,
    timeout: 5_000,
  });
  try {
    const integrity = database.prepare('PRAGMA integrity_check').all() as {
      integrity_check: string;
    }[];
    if (
      integrity.length !== 1 ||
      integrity[0]?.integrity_check.toLowerCase() !== 'ok'
    ) {
      throw new Error('SQLite backup failed its integrity check');
    }

    const tables = new Set(
      (
        database
          .prepare(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'table'`,
          )
          .all() as { name: string }[]
      ).map((row) => row.name),
    );
    if (requiredTables.some((table) => !tables.has(table))) {
      throw new Error('SQLite backup does not contain the required schema');
    }
  } finally {
    database.close();
  }
}

function assertPathInsideDirectory(path: string, directory: string): void {
  const resolvedDirectory = resolve(directory);
  const resolvedPath = resolve(path);
  const relativePath = relative(resolvedDirectory, resolvedPath);
  if (
    relativePath.length === 0 ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    relativePath.startsWith('..\\') ||
    isAbsolute(relativePath)
  ) {
    throw new Error('Backup path must stay inside the backup directory');
  }
}
