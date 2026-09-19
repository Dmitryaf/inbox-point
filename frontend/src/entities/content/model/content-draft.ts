import {
  informationSectionIds,
  type ContentDraft,
  type ContentSnapshot,
  type InformationSectionId,
} from './types';

export function createEmptyContent(): ContentDraft {
  return {
    address: '',
    customSections: [],
    faq: [],
    legacySchedule: '',
    prices: '',
    schedule: [],
    visibleSections: [...informationSectionIds],
  };
}

export function normalizeContentDraft(
  content: ContentSnapshot['content'] | ContentDraft,
): ContentDraft {
  const apiScheduleItems =
    'scheduleItems' in content && Array.isArray(content.scheduleItems)
      ? content.scheduleItems
      : undefined;
  const legacySchedule = apiScheduleItems?.length
    ? ''
    : typeof content.schedule === 'string'
      ? content.schedule
      : 'legacySchedule' in content
        ? content.legacySchedule
        : '';
  const schedule =
    apiScheduleItems ??
    (Array.isArray(content.schedule) ? content.schedule : []);
  return {
    address: content.address ?? '',
    customSections:
      content.customSections?.map((section) => ({ ...section })) ?? [],
    faq: content.faq?.map((item) => ({ ...item })) ?? [],
    legacySchedule,
    prices: content.prices ?? '',
    schedule: schedule.map((item) => ({ ...item })),
    visibleSections: content.visibleSections
      ? [...content.visibleSections]
      : [...informationSectionIds],
  };
}

export function snapshotContent(content: ContentDraft): string {
  return JSON.stringify(content);
}

export function copyContentDraft(content: ContentDraft): ContentDraft {
  return {
    ...content,
    customSections: content.customSections.map((section) => ({ ...section })),
    faq: content.faq.map((item) => ({ ...item })),
    schedule: content.schedule.map((item) => ({ ...item })),
    visibleSections: [...content.visibleSections],
  };
}

export function isSectionVisible(
  content: ContentDraft,
  section: InformationSectionId,
): boolean {
  return content.visibleSections.includes(section);
}
