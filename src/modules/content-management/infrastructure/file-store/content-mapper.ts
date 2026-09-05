import {
  type ClientInformationContent,
  hasValidClientInformationResponses,
  hasValidCustomSections,
  hasValidFaqItems,
} from '@/core/application/client-information.js';
import type { ContentPayload, LegacyContentPayload } from './schema.js';

export function validateContent(
  value: ContentPayload,
): ClientInformationContent {
  const content = pickContent(value);
  if (
    !hasValidCustomSections(content.customSections ?? []) ||
    !hasValidFaqItems(content.faq ?? []) ||
    !hasValidClientInformationResponses(content)
  ) {
    throw new Error('The local content settings are invalid');
  }
  return content;
}

export function pickContent(value: ContentPayload): ClientInformationContent {
  return {
    ...(value.address ? { address: value.address } : {}),
    ...(value.customSections
      ? {
          customSections: value.customSections.map((section) => ({
            ...section,
          })),
        }
      : {}),
    ...(value.faq ? { faq: value.faq.map((item) => ({ ...item })) } : {}),
    ...(value.prices ? { prices: value.prices } : {}),
    ...(value.schedule ? { schedule: value.schedule } : {}),
    ...(value.visibleSections
      ? { visibleSections: [...value.visibleSections] }
      : {}),
  };
}

export function migrateLegacyContent(
  value: LegacyContentPayload,
): ClientInformationContent {
  const legacyFaq = value.customSections
    ?.filter((section) => section.format === 'faq')
    .flatMap((section) => parseLegacyFaqText(section.text));
  return {
    ...(value.address ? { address: value.address } : {}),
    ...(value.customSections
      ? {
          customSections: value.customSections
            .filter((section) => section.format !== 'faq')
            .map(({ label, text }) => ({ label, text })),
        }
      : {}),
    ...(legacyFaq?.length ? { faq: legacyFaq } : {}),
    ...(value.prices ? { prices: value.prices } : {}),
    ...(value.schedule ? { schedule: value.schedule } : {}),
  };
}

export function copyContent(
  content: ClientInformationContent,
): ClientInformationContent {
  return {
    ...content,
    ...(content.customSections
      ? {
          customSections: content.customSections.map((section) => ({
            ...section,
          })),
        }
      : {}),
    ...(content.faq ? { faq: content.faq.map((item) => ({ ...item })) } : {}),
    ...(content.visibleSections
      ? { visibleSections: [...content.visibleSections] }
      : {}),
  };
}

function parseLegacyFaqText(text: string) {
  return text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => {
      const [question = '', ...answer] = block
        .split(/\r?\n/)
        .map((line) => line.trim());
      return { answer: answer.filter(Boolean).join('\n'), question };
    })
    .filter((item) => item.question && item.answer);
}
