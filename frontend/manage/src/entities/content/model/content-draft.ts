import type { ContentDraft } from './types';

export function createEmptyContent(): ContentDraft {
  return {
    address: '',
    customSections: [],
    faq: [],
    prices: '',
    schedule: '',
  };
}

export function normalizeContentDraft(
  content: Partial<ContentDraft>,
): ContentDraft {
  return {
    address: content.address ?? '',
    customSections:
      content.customSections?.map((section) => ({ ...section })) ?? [],
    faq: content.faq?.map((item) => ({ ...item })) ?? [],
    prices: content.prices ?? '',
    schedule: content.schedule ?? '',
  };
}

export function snapshotContent(content: ContentDraft): string {
  return JSON.stringify(content);
}

export function hasContent(content: ContentDraft): boolean {
  return (
    Boolean(content.schedule.trim()) ||
    Boolean(content.prices.trim()) ||
    Boolean(content.address.trim()) ||
    content.faq.some((item) => item.question.trim() && item.answer.trim()) ||
    content.customSections.some(
      (section) => section.label.trim() && section.text.trim(),
    )
  );
}
