import { randomUUID } from 'node:crypto';
import type { ClientInformationContent } from '@/core/application/client-information.js';

// Matching is only for upgrading legacy content. Once saved, identity is the UUID.
export function identifyCustomSections(
  content: ClientInformationContent,
  previous: ClientInformationContent = {},
): ClientInformationContent {
  if (!content.customSections) {
    return content;
  }
  const used = new Set(
    content.customSections.flatMap((section) =>
      section.id ? [section.id] : [],
    ),
  );
  return {
    ...content,
    customSections: content.customSections.map((section) => {
      if (section.id) {
        return { ...section };
      }
      const matches =
        previous.customSections?.filter(
          (candidate) =>
            candidate.id &&
            !used.has(candidate.id) &&
            candidate.label === section.label,
        ) ?? [];
      const id =
        matches.length === 1 ? (matches[0]?.id ?? randomUUID()) : randomUUID();
      used.add(id);
      return { ...section, id };
    }),
  };
}
