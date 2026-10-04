import { getMenuActionValues } from '@/core/application/client-information.js';
import type { ContentSettingsDocument } from '@/modules/content-management/application/ports/content-settings-store.js';

export function findHistoricalMenuActions(
  document: ContentSettingsDocument | undefined,
): readonly string[] {
  if (!document) {
    return [];
  }
  const currentMenuActions = new Set(getMenuActionValues(document.content));
  const historicalMenuActions = new Set<string>();
  for (const entry of document.history) {
    for (const action of getMenuActionValues(entry.content)) {
      if (!currentMenuActions.has(action)) {
        historicalMenuActions.add(action);
      }
    }
  }
  for (const action of document.legacyPreviousMenuActions ?? []) {
    if (!currentMenuActions.has(action)) {
      historicalMenuActions.add(action);
    }
  }
  return [...historicalMenuActions];
}

export function nextRevision(
  document: ContentSettingsDocument | undefined,
): number {
  return (
    Math.max(0, ...(document?.history.map((entry) => entry.revision) ?? [])) + 1
  );
}
