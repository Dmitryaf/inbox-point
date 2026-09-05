import { isSectionVisible } from '@frontend/entities/content/model/content-draft';
import type {
  ContentDraft,
  FaqItem,
} from '@frontend/entities/content/model/types';

export interface ClientResponsePreview {
  label: string;
  text: string;
}

export function buildClientResponsePreviews(
  content: ContentDraft,
): ClientResponsePreview[] {
  const responses: ClientResponsePreview[] = [];
  addStandardResponse(responses, content, 'schedule', 'Расписание');
  addStandardResponse(responses, content, 'prices', 'Цены');
  if (isSectionVisible(content, 'address') && content.address.trim()) {
    responses.push({
      label: 'Адрес',
      text: formatAddressResponse(content.address),
    });
  }
  const faq = normalizeFaqItems(content.faq);
  if (isSectionVisible(content, 'faq') && faq.length > 0) {
    responses.push({
      label: 'Частые вопросы',
      text: formatFaqResponse(faq),
    });
  }
  for (const section of content.customSections) {
    if (section.label.trim() && section.text.trim()) {
      responses.push({
        label: section.label.trim(),
        text: section.text.trim(),
      });
    }
  }
  return responses;
}

export function formatFaqResponse(items: readonly FaqItem[]): string {
  return `Частые вопросы\n\n${items
    .map((item) => `❓ ${item.question}\n${item.answer}`)
    .join('\n\n────────\n\n')}`;
}

export function formatAddressResponse(text: string): string {
  return `Адрес\n\n${text.trim()}`;
}

export function formatListResponse(label: string, text: string): string {
  const items = text
    .trim()
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);
  return `${label}\n\n${items.map((item) => `• ${item}`).join('\n')}`;
}

export function normalizeFaqItems(items: readonly FaqItem[]): FaqItem[] {
  return items
    .map((item) => ({
      answer: item.answer.trim(),
      question: item.question.trim(),
    }))
    .filter((item) => item.question || item.answer);
}

function addStandardResponse(
  responses: ClientResponsePreview[],
  content: ContentDraft,
  section: 'prices' | 'schedule',
  label: string,
): void {
  const value = content[section];
  if (!isSectionVisible(content, section) || !value.trim()) {
    return;
  }
  responses.push({
    label,
    text: formatListResponse(label, value),
  });
}
