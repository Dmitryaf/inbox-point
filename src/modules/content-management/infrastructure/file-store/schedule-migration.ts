import { createHash } from 'node:crypto';
import {
  readOptionalTextFile,
  writePrivateTextFile,
} from '@/infrastructure/file-system/local-state-file.js';
import { migrateSchedule } from '@/modules/content-management/application/schedule-migration.js';
import type { ContentSettingsDocument } from '@/modules/content-management/application/ports/content-settings-store.js';
import {
  parseContentDocument,
  serializeContentDocument,
} from './document-codec.js';

export async function migrateScheduleDocument(
  path: string,
  original: string,
  document: ContentSettingsDocument,
): Promise<ContentSettingsDocument> {
  const result = {
    ...document,
    content: migrateSchedule(document.content),
    history: document.history.map((entry) => ({
      ...entry,
      content: migrateSchedule(entry.content),
    })),
  };
  if (JSON.stringify(result) === JSON.stringify(document)) {
    return document;
  }
  const serialized = serializeContentDocument(result);
  parseContentDocument(serialized);
  const hash = createHash('sha256').update(original).digest('hex');
  const backupPath = `${path}.before-classes-${hash}.json`;
  const backup = await readOptionalTextFile(backupPath);
  if (backup !== undefined && backup !== original) {
    throw new Error('The schedule migration backup does not match the source');
  }
  if (backup === undefined) {
    await writePrivateTextFile(backupPath, original);
  }
  if ((await readOptionalTextFile(backupPath)) !== original) {
    throw new Error('The schedule migration backup could not be verified');
  }
  await writePrivateTextFile(path, serialized);
  if ((await readOptionalTextFile(path)) !== serialized) {
    throw new Error('The migrated schedule could not be verified');
  }
  return result;
}
