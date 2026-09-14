import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, describe, expect, it } from 'vitest';

import { SqliteAdminSessionStore } from '@/infrastructure/persistence/sqlite-admin-session-store.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe('SqliteAdminSessionStore', () => {
  it('persists only a token hash and authenticates after restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-session-'));
    directories.push(directory);
    const databasePath = join(directory, 'inbox-point.sqlite');
    const rawToken = 'remembered-session-token';
    const firstStore = new SqliteAdminSessionStore(databasePath);
    const firstAccess = new PasswordSessionAccess('correct-admin-password', {
      createToken: () => rawToken,
      now: () => 1_000,
      rememberedSessionStore: firstStore,
      rememberedSessionTtlMs: 5_000,
    });

    firstAccess.login('correct-admin-password', 'client-1', true);
    firstStore.close();

    const database = new DatabaseSync(databasePath);
    const row = database
      .prepare(
        'SELECT token_hash, created_at, expires_at FROM remembered_admin_sessions',
      )
      .get() as {
      created_at: number;
      expires_at: number;
      token_hash: string;
    };
    database.close();
    expect(row).toMatchObject({ created_at: 1_000, expires_at: 6_000 });
    expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.token_hash).not.toBe(rawToken);

    const restartedStore = new SqliteAdminSessionStore(databasePath);
    const restartedAccess = new PasswordSessionAccess(
      'correct-admin-password',
      {
        now: () => 2_000,
        rememberedSessionStore: restartedStore,
      },
    );
    expect(restartedAccess.authenticate(rawToken)).toBe(true);

    restartedAccess.logout(rawToken);
    expect(restartedAccess.authenticate(rawToken)).toBe(false);
    restartedStore.close();
  });

  it('rejects and removes an expired persisted session', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-session-'));
    directories.push(directory);
    const databasePath = join(directory, 'inbox-point.sqlite');
    const store = new SqliteAdminSessionStore(databasePath);
    const initialAccess = new PasswordSessionAccess('correct-admin-password', {
      createToken: () => 'remembered-session-token',
      now: () => 1_000,
      rememberedSessionStore: store,
      rememberedSessionTtlMs: 1_000,
    });
    initialAccess.login('correct-admin-password', 'client-1', true);
    const restartedAccess = new PasswordSessionAccess(
      'correct-admin-password',
      {
        now: () => 2_001,
        rememberedSessionStore: store,
      },
    );

    expect(restartedAccess.authenticate('remembered-session-token')).toBe(
      false,
    );
    const database = new DatabaseSync(databasePath);
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM remembered_admin_sessions')
        .get(),
    ).toEqual({ count: 0 });
    database.close();
    store.close();
  });
});
