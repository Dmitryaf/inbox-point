import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadExternalBackupConfig } from '@/config/external-backup-config.js';

describe('loadExternalBackupConfig', () => {
  it('requires an export path outside application data', () => {
    expect(() =>
      loadExternalBackupConfig({
        BACKUP_ALERT_WEBHOOK_URL: 'https://alerts.example.test/backup',
        BACKUP_EXPORT_PATH: './data/backups',
        DATABASE_PATH: './data/messenger-handoff.sqlite',
      }),
    ).toThrow('outside the application data');
  });

  it('maps an external backup target and independent alert', () => {
    const config = loadExternalBackupConfig({
      BACKUP_ALERT_BEARER_TOKEN: 'synthetic-token',
      BACKUP_ALERT_WEBHOOK_URL: 'https://alerts.example.test/backup',
      BACKUP_EXPORT_PATH: '../external-backups',
      BACKUP_TIMEOUT_SECONDS: '5',
      CLOSED_REQUEST_RETENTION_DAYS: '14',
      DATABASE_PATH: './data/messenger-handoff.sqlite',
    });

    expect(config).toMatchObject({
      alertBearerToken: 'synthetic-token',
      databasePath: resolve('./data/messenger-handoff.sqlite'),
      exportPath: resolve('../external-backups'),
      instanceId: 'default',
      retentionDays: 14,
      timeoutMs: 5_000,
    });
  });

  it('maps an explicit operational instance label', () => {
    expect(
      loadExternalBackupConfig({
        BACKUP_ALERT_WEBHOOK_URL: 'https://alerts.example.test/backup',
        BACKUP_EXPORT_PATH: '../external-backups',
        DATABASE_PATH: './data/messenger-handoff.sqlite',
        INSTANCE_ID: 'instance-a',
      }),
    ).toMatchObject({ instanceId: 'instance-a' });
  });
});
