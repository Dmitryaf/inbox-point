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
  prices: string;
  schedule: string;
  visibleSections: InformationSectionId[];
}

export interface ContentChange {
  changedAt: string;
  revision?: number;
  sections: string[];
}

export interface ContentSnapshot {
  content: Partial<ContentDraft>;
  version: string;
}
