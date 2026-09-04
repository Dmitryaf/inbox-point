import type { ClientInformationContent } from '@/core/application/client-information.js';
import {
  copyContent,
  migrateLegacyContent,
  validateContent,
} from './content-mapper.js';
import {
  contentPayloadSchema,
  storedContentSchema,
  storedContentV4Schema,
} from './schema.js';
import type {
  ContentSectionKey,
  ContentSettingsDocument,
} from '@/modules/content-management/application/ports/content-settings-store.js';

export function parseContentDocument(
  contents: string,
): ContentSettingsDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('The local content settings are invalid');
  }
  const result = storedContentSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('The local content settings are invalid');
  }

  let content: ClientInformationContent;
  if (result.data.version === 1) {
    content = migrateLegacyContent(result.data);
  } else if (result.data.version === 2) {
    content = migrateLegacyContent(result.data.content);
  } else {
    content = validateContent(result.data.content);
  }
  return {
    content: copyContent(content),
    history:
      result.data.version === 1
        ? []
        : result.data.history.map((entry) => ({
            changedAt: entry.changedAt,
            ...('revision' in entry
              ? {
                  content: validateContent(entry.content),
                  revision: entry.revision,
                }
              : {}),
            sections: [...entry.sections],
          })),
  };
}

export function serializeContentDocument(
  document: ContentSettingsDocument,
): string {
  const validated = storedContentV4Schema.parse({
    content: document.content,
    history: document.history,
    version: 4,
  });
  return JSON.stringify(validated, undefined, 2) + '\n';
}

export function validateContentInput(
  content: ClientInformationContent,
): ClientInformationContent {
  return validateContent(contentPayloadSchema.parse(content));
}

export function findChangedSections(
  previous: ClientInformationContent,
  next: ClientInformationContent,
): ContentSectionKey[] {
  const sections: ContentSectionKey[] = [];
  if (previous.schedule !== next.schedule) {
    sections.push('schedule');
  }
  if (previous.prices !== next.prices) {
    sections.push('prices');
  }
  if (previous.address !== next.address) {
    sections.push('address');
  }
  if (JSON.stringify(previous.faq ?? []) !== JSON.stringify(next.faq ?? [])) {
    sections.push('faq');
  }
  if (
    JSON.stringify(previous.customSections ?? []) !==
    JSON.stringify(next.customSections ?? [])
  ) {
    sections.push('customSections');
  }
  return sections;
}
