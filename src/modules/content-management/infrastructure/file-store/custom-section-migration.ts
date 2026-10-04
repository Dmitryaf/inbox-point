import type { ClientInformationContent } from '@/core/application/client-information.js';
import { identifyCustomSections } from '@/modules/content-management/application/custom-section-identity.js';
import type { ContentSettingsDocument } from '@/modules/content-management/application/ports/content-settings-store.js';

export function migrateCustomSectionIds(document: ContentSettingsDocument): {
  document: ContentSettingsDocument;
  changed: boolean;
} {
  let previous: ClientInformationContent = {};
  let changed = false;
  const identify = (content: ClientInformationContent) => {
    changed ||= content.customSections?.some((section) => !section.id) ?? false;
    const identified = identifyCustomSections(content, previous);
    previous = identified;
    return identified;
  };
  const history = [...document.history]
    .reverse()
    .map((entry) => ({ ...entry, content: identify(entry.content) }))
    .reverse();
  return {
    document: { ...document, history, content: identify(document.content) },
    changed,
  };
}
