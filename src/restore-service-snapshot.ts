import { restoreServiceSnapshot } from '@/infrastructure/persistence/service-snapshot.js';

async function main(): Promise<void> {
  const [snapshotPath, targetDirectory] = process.argv.slice(2);
  if (!snapshotPath || !targetDirectory) {
    throw new Error(
      'Usage: npm run snapshot:restore -- <snapshot-path> <new-target-directory>',
    );
  }

  const restored = await restoreServiceSnapshot(snapshotPath, targetDirectory);
  console.log(restored.databasePath);
}

main().catch((error: unknown) => {
  console.error('Failed to restore service snapshot', error);
  process.exitCode = 1;
});
