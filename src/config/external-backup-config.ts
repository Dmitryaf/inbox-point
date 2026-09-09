import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { z } from 'zod';

const schema = z.object({
  BACKUP_ALERT_BEARER_TOKEN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).max(500).optional(),
  ),
  BACKUP_ALERT_WEBHOOK_URL: z.url().startsWith('https://'),
  BACKUP_EXPORT_PATH: z.string().min(1),
  BACKUP_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(30).default(10),
  CLOSED_REQUEST_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(365)
    .default(7),
  DATABASE_PATH: z.string().min(1),
});

export interface ExternalBackupConfig {
  alertBearerToken?: string;
  alertWebhookUrl: URL;
  databasePath: string;
  exportPath: string;
  retentionDays: number;
  timeoutMs: number;
}

export function loadExternalBackupConfig(
  environment: NodeJS.ProcessEnv,
): ExternalBackupConfig {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      'External backup requires database, export path, retention, and an HTTPS alert webhook',
    );
  }
  const databasePath = resolve(result.data.DATABASE_PATH);
  const exportPath = resolve(result.data.BACKUP_EXPORT_PATH);
  assertExternalExportPath(databasePath, exportPath);
  return {
    ...(result.data.BACKUP_ALERT_BEARER_TOKEN
      ? { alertBearerToken: result.data.BACKUP_ALERT_BEARER_TOKEN }
      : {}),
    alertWebhookUrl: new URL(result.data.BACKUP_ALERT_WEBHOOK_URL),
    databasePath,
    exportPath,
    retentionDays: result.data.CLOSED_REQUEST_RETENTION_DAYS,
    timeoutMs: result.data.BACKUP_TIMEOUT_SECONDS * 1_000,
  };
}

function assertExternalExportPath(
  databasePath: string,
  exportPath: string,
): void {
  const dataDirectory = dirname(databasePath);
  const pathFromData = relative(dataDirectory, exportPath);
  if (
    pathFromData === '' ||
    (!pathFromData.startsWith('..') && !isAbsolute(pathFromData))
  ) {
    throw new Error('Backup export path must be outside the application data');
  }
}
