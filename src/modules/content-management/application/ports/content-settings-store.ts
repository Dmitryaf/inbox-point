import type { ClientInformationContent } from '@/core/application/client-information.js';

export type ContentSectionKey =
  'address' | 'customSections' | 'faq' | 'prices' | 'schedule' | 'visibility';

export interface ContentChange {
  changedAt: string;
  revision?: number;
  sections: readonly ContentSectionKey[];
}

export interface StoredContentChange extends ContentChange {
  content?: ClientInformationContent;
}

export interface ContentSettingsDocument {
  content: ClientInformationContent;
  history: readonly StoredContentChange[];
}

export interface ContentSettingsStore {
  load(): Promise<ClientInformationContent | undefined>;
  loadHistory(): Promise<readonly ContentChange[]>;
  restore(revision: number): Promise<ClientInformationContent>;
  save(content: ClientInformationContent): Promise<void>;
}
