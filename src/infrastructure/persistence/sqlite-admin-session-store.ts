import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { initializeSqliteSchema } from '@/infrastructure/persistence/sqlite-schema.js';
import type {
  RememberedAdminSession,
  RememberedAdminSessionStore,
} from '@/infrastructure/security/remembered-session-store.js';

export class SqliteAdminSessionStore implements RememberedAdminSessionStore {
  private readonly database: DatabaseSync;

  public constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.database = new DatabaseSync(path, {
      enableForeignKeyConstraints: true,
      timeout: 5_000,
    });
    this.database.exec('PRAGMA journal_mode = WAL');
    this.database.exec('PRAGMA synchronous = FULL');
    try {
      initializeSqliteSchema(this.database);
    } catch (error: unknown) {
      this.database.close();
      throw error;
    }
  }

  public close(): void {
    this.database.close();
  }

  public delete(tokenHash: string): void {
    this.database
      .prepare('DELETE FROM remembered_admin_sessions WHERE token_hash = ?')
      .run(tokenHash);
  }

  public deleteAll(): void {
    this.database.exec('DELETE FROM remembered_admin_sessions');
  }

  public hasActive(tokenHash: string, now: number): boolean {
    const row = this.database
      .prepare(
        `SELECT expires_at
         FROM remembered_admin_sessions
         WHERE token_hash = ?`,
      )
      .get(tokenHash) as { expires_at: number } | undefined;
    if (!row) {
      return false;
    }
    if (row.expires_at <= now) {
      this.delete(tokenHash);
      return false;
    }
    return true;
  }

  public save(session: RememberedAdminSession): void {
    this.database
      .prepare(
        `INSERT INTO remembered_admin_sessions (
          token_hash,
          created_at,
          expires_at
        ) VALUES (?, ?, ?)`,
      )
      .run(session.tokenHash, session.createdAt, session.expiresAt);
  }
}
