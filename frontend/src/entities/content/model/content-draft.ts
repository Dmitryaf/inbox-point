import {
  informationSectionIds,
  type ContentDraft,
  type InformationSectionId,
} from './types';

export function createEmptyContent(): ContentDraft {
  return {
    address: '',
    customSections: [],
    faq: [],
    prices: '',
    schedule: '',
    visibleSections: [...informationSectionIds],
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
    visibleSections: content.visibleSections
      ? [...content.visibleSections]
      : [...informationSectionIds],
  };
}

export function snapshotContent(content: ContentDraft): string {
  return JSON.stringify(content);
}

export function hasContent(content: ContentDraft): boolean {
  return (
    (isSectionVisible(content, 'schedule') &&
      Boolean(content.schedule.trim())) ||
    (isSectionVisible(content, 'prices') && Boolean(content.prices.trim())) ||
    (isSectionVisible(content, 'address') && Boolean(content.address.trim())) ||
    (isSectionVisible(content, 'faq') &&
      content.faq.some((item) => item.question.trim() && item.answer.trim())) ||
    content.customSections.some(
      (section) => section.label.trim() && section.text.trim(),
    )
  );
}

export function isSectionVisible(
  content: ContentDraft,
  section: InformationSectionId,
): boolean {
  return content.visibleSections.includes(section);
}
