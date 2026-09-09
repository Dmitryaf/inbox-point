import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DataRetentionService } from '@/core/application/data-retention-service.js';
import {
  restoreServiceSnapshot,
  ServiceSnapshotService,
  verifyServiceSnapshot,
} from '@/infrastructure/persistence/service-snapshot.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { FileContentSettingsStore } from '@/modules/content-management/infrastructure/file-store/file-content-settings-store.js';
import { FileServiceControlStore } from '@/modules/service-control/infrastructure/file-store/file-service-control-store.js';

const temporaryDirectories: string[] = [];
const silentRetentionLogger = {
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('ServiceSnapshotService', () => {
  it('restores retained data, content, and pause state without channel secrets', async () => {
    const directory = createTemporaryDirectory();
    const dataDirectory = join(directory, 'data');
    const databasePath = join(dataDirectory, 'messenger-handoff.sqlite');
    const repository = new SqliteSupportRepository(databasePath);
    repository.createRequest({
      channel: 'telegram',
      closedAt: new Date('2026-08-20T12:10:00.000Z'),
      conversationId: '101',
      createdAt: new Date('2026-08-20T12:00:00.000Z'),
      displayName: 'Private name',
      id: 'request-1',
      operatorTopicId: 'topic-1',
      status: 'closed',
    });
    repository.recordConversationMessage({
      createdAt: new Date('2026-08-20T12:01:00.000Z'),
      direction: 'client_to_operator',
      externalMessageId: 'message-1',
      id: 'message-1',
      requestId: 'request-1',
      text: 'Expired private text',
    });
    new DataRetentionService(repository, 7, silentRetentionLogger, {
      now: () => new Date('2026-09-06T12:00:00.000Z'),
    }).run();

    const contentStore = new FileContentSettingsStore(
      join(dataDirectory, 'content-settings.json'),
    );
    await contentStore.save({ schedule: 'Monday 18:00' });
    const controlStore = new FileServiceControlStore(
      join(dataDirectory, 'service-control.json'),
    );
    await controlStore.save({
      channels: {
        telegram: { mode: 'paused' },
        vk: { mode: 'active' },
      },
      delivery: { mode: 'active' },
    });
    writeFileSync(
      join(dataDirectory, 'telegram-settings.json'),
      '{"token":"must-not-be-copied"}',
    );
    writeFileSync(
      join(dataDirectory, 'vk-settings.json'),
      '{"accessToken":"must-not-be-copied"}',
    );

    const snapshot = await new ServiceSnapshotService(databasePath, {
      clock: () => new Date('2026-09-06T12:05:00.000Z'),
      createId: () => 'snapshot-1',
    }).createSnapshot();
    const manifest = await verifyServiceSnapshot(snapshot.path);
    expect(manifest).toMatchObject({
      closedRequestRetentionDays: 7,
      expiresAt: '2026-09-13T12:05:00.000Z',
      formatVersion: 1,
      secretsIncluded: false,
      sqliteSchemaVersion: 5,
    });
    expect(manifest.files.map((file) => file.name)).toEqual([
      'database.sqlite',
      'content-settings.json',
      'service-control.json',
    ]);
    expect(readdirSync(snapshot.path)).not.toContain('telegram-settings.json');
    expect(readdirSync(snapshot.path)).not.toContain('vk-settings.json');

    const restoreDirectory = join(directory, 'restored-data');
    const restored = await restoreServiceSnapshot(
      snapshot.path,
      restoreDirectory,
    );
    const restoredRepository = new SqliteSupportRepository(
      restored.databasePath,
    );
    expect(restoredRepository.findRequestById('request-1')).not.toHaveProperty(
      'displayName',
    );
    expect(
      restoredRepository.findConversationMessages('request-1', 10),
    ).toEqual([]);
    expect(
      new DataRetentionService(restoredRepository, 7, silentRetentionLogger, {
        now: () => new Date('2026-09-06T12:10:00.000Z'),
      }).run(),
    ).toMatchObject({ messagesDeleted: 0, requestsAnonymized: 0 });
    restoredRepository.close();
    expect(
      await new FileContentSettingsStore(restored.contentSettingsPath!).load(),
    ).toMatchObject({ schedule: 'Monday 18:00' });
    expect(
      await new FileServiceControlStore(restored.serviceControlPath!).load(),
    ).toMatchObject({ channels: { telegram: { mode: 'paused' } } });
    expect(readdirSync(restoreDirectory)).not.toContain(
      'telegram-settings.json',
    );
    repository.close();
  });

  it('refuses to preserve expired content when cleanup has not run', async () => {
    const directory = createTemporaryDirectory();
    const databasePath = join(directory, 'data', 'handoff.sqlite');
    const repository = new SqliteSupportRepository(databasePath);
    repository.createRequest({
      channel: 'telegram',
      closedAt: new Date('2026-08-20T12:10:00.000Z'),
      conversationId: '101',
      createdAt: new Date('2026-08-20T12:00:00.000Z'),
      displayName: 'Expired name',
      id: 'expired-request',
      operatorTopicId: 'expired-topic',
      status: 'closed',
    });

    await expect(
      new ServiceSnapshotService(databasePath, {
        clock: () => new Date('2026-09-06T12:00:00.000Z'),
        snapshotDirectory: join(directory, 'snapshots'),
      }).createSnapshot(),
    ).rejects.toThrow('Service snapshot contains content due for retention');
    repository.close();
  });

  it('rejects a modified snapshot before creating the restore target', async () => {
    const directory = createTemporaryDirectory();
    const databasePath = join(directory, 'data', 'handoff.sqlite');
    const repository = new SqliteSupportRepository(databasePath);
    const snapshot = await new ServiceSnapshotService(databasePath, {
      snapshotDirectory: join(directory, 'snapshots'),
    }).createSnapshot();
    writeFileSync(join(snapshot.path, 'database.sqlite'), 'tampered');
    const target = join(directory, 'must-not-exist');

    await expect(
      restoreServiceSnapshot(snapshot.path, target),
    ).rejects.toThrow();
    expect(existsSync(target)).toBe(false);
    repository.close();
  });

  it('deletes expired service snapshots but leaves unrelated directories', async () => {
    const directory = createTemporaryDirectory();
    const databasePath = join(directory, 'data', 'handoff.sqlite');
    const snapshotDirectory = join(directory, 'snapshots');
    const repository = new SqliteSupportRepository(databasePath);
    const oldSnapshot = await new ServiceSnapshotService(databasePath, {
      clock: () => new Date('2026-08-20T12:00:00.000Z'),
      createId: () => 'old',
      retentionDays: 7,
      snapshotDirectory,
    }).createSnapshot();
    utimesSync(
      oldSnapshot.path,
      new Date('2026-08-20T12:00:00.000Z'),
      new Date('2026-08-20T12:00:00.000Z'),
    );
    const unrelatedDirectory = join(snapshotDirectory, 'keep-me');
    mkdirSync(unrelatedDirectory);

    await new ServiceSnapshotService(databasePath, {
      clock: () => new Date('2026-09-01T12:00:00.000Z'),
      createId: () => 'current',
      retentionDays: 7,
      snapshotDirectory,
    }).createSnapshot();

    expect(existsSync(oldSnapshot.path)).toBe(false);
    expect(existsSync(unrelatedDirectory)).toBe(true);
    repository.close();
  });
});

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'handoff-snapshot-'));
  temporaryDirectories.push(directory);
  return directory;
}
