export interface FaqItem {
  answer: string;
  question: string;
}

export interface CustomSection {
  label: string;
  text: string;
}

export interface ContentDraft {
  address: string;
  customSections: CustomSection[];
  faq: FaqItem[];
  prices: string;
  schedule: string;
}

export interface ContentChange {
  changedAt: string;
  revision?: number;
  sections: string[];
}
