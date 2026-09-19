import type { ScheduleItem } from '@core/application/schedule-response';

export type { ScheduleItem } from '@core/application/schedule-response';

export interface FaqItem {
  answer: string;
  question: string;
}

export interface CustomSection {
  label: string;
  text: string;
}

export const informationSectionIds = [
  'schedule',
  'prices',
  'address',
  'faq',
] as const;

export type InformationSectionId = (typeof informationSectionIds)[number];

export interface ContentDraft {
  address: string;
  customSections: CustomSection[];
  faq: FaqItem[];
  legacySchedule: string;
  prices: string;
  schedule: ScheduleItem[];
  visibleSections: InformationSectionId[];
}

export interface ContentChange {
  changedAt: string;
  revision?: number;
  sections: string[];
}

export interface ContentSnapshot {
  content: Partial<Omit<ContentDraft, 'legacySchedule' | 'schedule'>> & {
    schedule?: string;
    scheduleItems?: ScheduleItem[];
  };
  version: string;
}
