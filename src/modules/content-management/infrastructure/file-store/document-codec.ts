import {
  informationSectionIds,
  type ClientInformationContent,
} from '@/core/application/client-information.js';
import { copyContent, validateContent } from './content-mapper.js';
import { contentPayloadSchema, storedContentSchema } from './schema.js';
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

  return {
    content: copyContent(validateContent(result.data.content)),
    history: result.data.history.map((entry) => ({
      changedAt: entry.changedAt,
      content: validateContent(entry.content),
      revision: entry.revision,
      sections: [...entry.sections],
    })),
  };
}

export function serializeContentDocument(
  document: ContentSettingsDocument,
): string {
  const validated = storedContentSchema.parse({
    content: document.content,
    history: document.history,
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
  if (
    JSON.stringify(previous.visibleSections ?? informationSectionIds) !==
    JSON.stringify(next.visibleSections ?? informationSectionIds)
  ) {
    sections.push('visibility');
  }
  return sections;
}
