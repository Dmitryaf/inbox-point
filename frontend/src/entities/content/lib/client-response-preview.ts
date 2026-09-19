import { isSectionVisible } from '@frontend/entities/content/model/content-draft';
import type {
  ContentDraft,
  FaqItem,
} from '@frontend/entities/content/model/types';
import {
  formatScheduleResponse,
  normalizeScheduleItems,
} from './schedule-response';

export interface ClientResponsePreview {
  group: 'custom' | 'information';
  label: string;
  text: string;
}

export function buildTelegramMenuPreviewRows(
  responses: readonly ClientResponsePreview[],
): string[][] {
  const informationButtons = responses
    .filter((response) => response.group === 'information')
    .map((response) => response.label);
  const customButtons = responses
    .filter((response) => response.group === 'custom')
    .map((response) => response.label);

  return [
    ...createButtonRows(informationButtons),
    ...createButtonRows(customButtons),
    ['Задать вопрос'],
  ];
}

export function buildClientResponsePreviews(
  content: ContentDraft,
): ClientResponsePreview[] {
  const responses: ClientResponsePreview[] = [];
  const schedule = normalizeScheduleItems(content.schedule);
  if (isSectionVisible(content, 'schedule')) {
    if (schedule.length > 0) {
      responses.push({
        group: 'information',
        label: 'Расписание',
        text: formatScheduleResponse(schedule),
      });
    } else if (content.legacySchedule.trim()) {
      responses.push({
        group: 'information',
        label: 'Расписание',
        text: formatListResponse('Расписание', content.legacySchedule),
      });
    }
  }
  addStandardResponse(responses, content, 'prices', 'Цены');
  if (isSectionVisible(content, 'address') && content.address.trim()) {
    responses.push({
      group: 'information',
      label: 'Адрес',
      text: formatAddressResponse(content.address),
    });
  }
  const faq = normalizeFaqItems(content.faq);
  if (isSectionVisible(content, 'faq') && faq.length > 0) {
    responses.push({
      group: 'information',
      label: 'Частые вопросы',
      text: formatFaqResponse(faq),
    });
  }
  for (const section of content.customSections) {
    if (section.label.trim() && section.text.trim()) {
      responses.push({
        group: 'custom',
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
  section: 'prices',
  label: string,
): void {
  const value = content[section];
  if (!isSectionVisible(content, section) || !value.trim()) {
    return;
  }
  responses.push({
    group: 'information',
    label,
    text: formatListResponse(label, value),
  });
}

function createButtonRows(buttons: readonly string[]): string[][] {
  const rows: string[][] = [];
  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }
  return rows;
}
