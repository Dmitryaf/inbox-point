import { loadExternalBackupConfig } from '@/config/external-backup-config.js';
import { WebhookAvailabilityAlert } from '@/infrastructure/monitoring/webhook-availability-alert.js';
import {
  ServiceSnapshotService,
  verifyServiceSnapshot,
} from '@/infrastructure/persistence/service-snapshot.js';

async function main(): Promise<void> {
  const config = loadExternalBackupConfig(process.env);
  const alert = new WebhookAvailabilityAlert(
    config.alertWebhookUrl,
    config.timeoutMs,
    config.instanceId,
    config.alertBearerToken,
  );
  try {
    const snapshot = await new ServiceSnapshotService(config.databasePath, {
      instanceId: config.instanceId,
      retentionDays: config.retentionDays,
      snapshotDirectory: config.exportPath,
    }).createSnapshot();
    await verifyServiceSnapshot(snapshot.path);
    console.log(snapshot.path);
  } catch (error: unknown) {
    try {
      await alert.send(
        `Messenger Handoff [${config.instanceId}]: не удалось создать или проверить внешний backup.`,
      );
    } catch (alertError: unknown) {
      console.error('Failed to send external backup alert', alertError);
    }
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error('Failed to create external service backup', error);
  process.exitCode = 1;
});
