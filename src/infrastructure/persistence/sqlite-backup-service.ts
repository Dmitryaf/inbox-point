import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { chmod, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';

import {
  requiredSqliteTables,
  sqliteSchemaVersion,
} from '@/infrastructure/persistence/sqlite-schema.js';

const millisecondsPerDay = 24 * 60 * 60 * 1_000;
const backupFilePattern = /^inbox-point-.*\.sqlite$/;

export interface SqliteBackup {
  createdAt: Date;
  fileName: string;
  path: string;
}

export interface SqliteBackupServiceOptions {
  backupDirectory?: string;
  clock?: () => Date;
  createId?: () => string;
  retentionDays?: number;
}

export class SqliteBackupService {
  private readonly backupDirectory: string;
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly retentionDays: number;

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
    this.retentionDays = options.retentionDays ?? 7;
    if (!Number.isInteger(this.retentionDays) || this.retentionDays < 1) {
      throw new Error('Backup retention days must be a positive integer');
    }
  }

  public async createBackup(): Promise<SqliteBackup> {
    const createdAt = this.clock();
    const timestamp = createdAt.toISOString().replaceAll(':', '-');
    const fileName = `inbox-point-${timestamp}-${this.createId()}.sqlite`;
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
      await this.deleteExpiredBackups(createdAt, finalPath);
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

  private async deleteExpiredBackups(
    now: Date,
    currentBackupPath: string,
  ): Promise<void> {
    const cutoff = now.getTime() - this.retentionDays * millisecondsPerDay;
    const entries = await readdir(this.backupDirectory, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isFile() || !backupFilePattern.test(entry.name)) {
        continue;
      }
      const path = join(this.backupDirectory, entry.name);
      if (resolve(path) === resolve(currentBackupPath)) {
        continue;
      }
      if ((await stat(path)).mtimeMs < cutoff) {
        await rm(path);
      }
    }
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
    if (requiredSqliteTables.some((table) => !tables.has(table))) {
      throw new Error('SQLite backup does not contain the required schema');
    }
    const version = database.prepare('PRAGMA user_version').get() as {
      user_version: number;
    };
    if (version.user_version !== sqliteSchemaVersion) {
      throw new Error('SQLite backup has an unsupported schema version');
    }
  } finally {
    database.close();
    rmSync(path + '-shm', { force: true });
    rmSync(path + '-wal', { force: true });
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
