import {
  formatAddressResponse,
  formatFaqResponse,
  formatListResponse,
  normalizeFaqItems,
} from '@frontend/entities/content/lib/client-response-preview';
import type { ContentDraft } from '@frontend/entities/content/model/types';

const messageLengthLimit = 4_000;
const reservedLabels = new Set(
  [
    'Расписание',
    'Цены',
    'Адрес',
    'Частые вопросы',
    'Задать вопрос преподавателю',
    'Начать новый вопрос',
    '/start',
    '/menu',
    'Начать',
    'FAQ',
  ].map((label) => label.toLowerCase()),
);

export interface ContentValidationResult {
  message: string;
  valid: boolean;
}

export function validateContentDraft(
  content: ContentDraft,
): ContentValidationResult {
  const incompleteFaq = normalizeFaqItems(content.faq).some(
    (item) => !item.question || !item.answer,
  );
  if (incompleteFaq) {
    return invalid('Заполните вопрос и ответ во всех карточках FAQ.');
  }

  const customLabels = content.customSections
    .map((section) => section.label.trim().toLowerCase())
    .filter(Boolean);
  const incompleteCustomSection = content.customSections.some((section) => {
    const label = section.label.trim();
    const text = section.text.trim();
    return Boolean(label || text) && !(label && text);
  });
  if (incompleteCustomSection) {
    return invalid('Заполните название и текст каждого своего раздела.');
  }
  if (new Set(customLabels).size !== customLabels.length) {
    return invalid('Названия своих разделов не должны повторяться.');
  }
  if (customLabels.some((label) => reservedLabels.has(label))) {
    return invalid('Название своего раздела совпадает со служебной кнопкой.');
  }

  const faq = normalizeFaqItems(content.faq);
  const responses = [
    content.schedule.trim()
      ? {
          label: 'Расписание',
          text: formatListResponse('Расписание', content.schedule),
        }
      : undefined,
    content.prices.trim()
      ? { label: 'Цены', text: formatListResponse('Цены', content.prices) }
      : undefined,
    content.address.trim()
      ? { label: 'Адрес', text: formatAddressResponse(content.address) }
      : undefined,
    faq.length > 0
      ? { label: 'Частые вопросы', text: formatFaqResponse(faq) }
      : undefined,
    ...content.customSections
      .filter((section) => section.label.trim() && section.text.trim())
      .map((section) => ({
        label: section.label.trim(),
        text: section.text.trim(),
      })),
  ].filter((response) => response !== undefined);
  const oversizedResponse = responses.find(
    (response) => response.text.length > messageLengthLimit,
  );
  if (oversizedResponse) {
    return invalid(
      `Сократите раздел «${oversizedResponse.label}»: ответ длиннее 4000 символов.`,
    );
  }

  return { message: '', valid: true };
}

function invalid(message: string): ContentValidationResult {
  return { message, valid: false };
}
