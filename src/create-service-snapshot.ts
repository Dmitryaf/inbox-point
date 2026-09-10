import { loadRuntimeConfig } from '@/config/runtime-config.js';
import { ServiceSnapshotService } from '@/infrastructure/persistence/service-snapshot.js';

async function main(): Promise<void> {
  const config = loadRuntimeConfig(process.env);
  const service = new ServiceSnapshotService(config.databasePath, {
    instanceId: config.instanceId,
    retentionDays: config.closedRequestRetentionDays,
  });
  const snapshot = await service.createSnapshot();
  console.log(snapshot.path);
}

main().catch((error: unknown) => {
  console.error('Failed to create service snapshot', error);
  process.exitCode = 1;
});
