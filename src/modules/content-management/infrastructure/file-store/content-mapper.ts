import {
  type ClientInformationContent,
  hasValidClientInformationResponses,
  hasValidCustomSections,
  hasValidFaqItems,
} from '@/core/application/client-information.js';
import type { ContentPayload } from './schema.js';

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
