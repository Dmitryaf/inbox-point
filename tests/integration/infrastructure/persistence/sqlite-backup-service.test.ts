import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, describe, expect, it } from 'vitest';

import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import {
  SqliteBackupService,
  verifySqliteBackup,
} from '@/infrastructure/persistence/sqlite-backup-service.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('SqliteBackupService', () => {
  it('creates an integrity-checked snapshot that can be reopened', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-backup-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'handoff.sqlite');
    const repository = new SqliteSupportRepository(databasePath);
    repository.createRequest({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'active',
    });
    repository.enqueueDelivery({
      channel: 'telegram',
      conversationId: '101',
      createdAt: new Date('2026-09-01T12:01:00.000Z'),
      id: 'delivery-1',
      idempotencyKey: 'operator:update-1',
      operatorMessageId: 'operator-message-1',
      requestId: 'request-1',
      text: 'Synthetic answer',
    });
    const backups = new SqliteBackupService(databasePath, {
      backupDirectory: join(directory, 'backups'),
      clock: () => new Date('2026-09-01T12:02:00.000Z'),
      createId: () => 'backup-1',
    });

    const result = await backups.createBackup();

    expect(result.fileName).toBe(
      'messenger-handoff-2026-09-01T12-02-00.000Z-backup-1.sqlite',
    );
    expect(() => verifySqliteBackup(result.path)).not.toThrow();
    const restored = new SqliteSupportRepository(result.path);
    expect(restored.findActiveRequest('telegram', '101')).toMatchObject({
      id: 'request-1',
      operatorTopicId: 'topic-1',
    });
    expect(
      restored.findPendingDeliveries(new Date('2026-09-01T12:03:00.000Z'), 10),
    ).toEqual([
      expect.objectContaining({
        id: 'delivery-1',
        text: 'Synthetic answer',
      }),
    ]);
    restored.close();
    repository.close();
  });

  it('rejects a valid SQLite file without the application schema', () => {
    const directory = mkdtempSync(join(tmpdir(), 'messenger-handoff-backup-'));
    temporaryDirectories.push(directory);
    const unrelatedPath = join(directory, 'unrelated.sqlite');
    const unrelated = new DatabaseSync(unrelatedPath);
    unrelated.exec('CREATE TABLE unrelated (id TEXT PRIMARY KEY) STRICT');
    unrelated.close();

    expect(() => verifySqliteBackup(unrelatedPath)).toThrowError(
      'SQLite backup does not contain the required schema',
    );
  });
});
