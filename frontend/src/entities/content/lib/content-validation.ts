import { findOversizedContentResponse } from '@frontend/entities/content/lib/content-response-limit';
import type { ContentDraft } from '@frontend/entities/content/model/types';

const reservedLabels = new Set(
  [
    'Расписание',
    'Цены',
    'Адрес',
    'Частые вопросы',
    'Задать вопрос',
    'Начать новый вопрос',
    '/start',
    '/menu',
    'Начать',
  ].map((label) => label.toLowerCase()),
);

export interface ContentValidationResult {
  issues: readonly ContentValidationIssue[];
  message: string;
  valid: boolean;
}

export interface ContentValidationIssue {
  fieldId: string;
  message: string;
  section: 'core' | 'custom' | 'faq';
}

export function validateContentDraft(
  content: ContentDraft,
): ContentValidationResult {
  const incompleteFaqIndex = content.faq.findIndex(
    (item) => !item.question.trim() || !item.answer.trim(),
  );
  if (incompleteFaqIndex >= 0) {
    const item = content.faq[incompleteFaqIndex]!;
    return invalid(
      'Заполните вопрос и ответ в этой карточке.',
      item.question.trim()
        ? `faq-answer-${incompleteFaqIndex}`
        : `faq-question-${incompleteFaqIndex}`,
      'faq',
    );
  }

  const customLabels = content.customSections
    .map((section) => section.label.trim().toLowerCase())
    .filter(Boolean);
  const incompleteCustomIndex = content.customSections.findIndex(
    (section) => !section.label.trim() || !section.text.trim(),
  );
  if (incompleteCustomIndex >= 0) {
    const section = content.customSections[incompleteCustomIndex]!;
    return invalid(
      'Заполните название и текст этого раздела.',
      section.label.trim()
        ? `section-text-${incompleteCustomIndex}`
        : `section-label-${incompleteCustomIndex}`,
      'custom',
    );
  }
  if (new Set(customLabels).size !== customLabels.length) {
    const duplicateIndex = customLabels.findIndex(
      (label, index) => customLabels.indexOf(label) !== index,
    );
    return invalid(
      'Это название уже используется другим разделом.',
      `section-label-${duplicateIndex}`,
      'custom',
    );
  }
  const reservedIndex = customLabels.findIndex((label) =>
    reservedLabels.has(label),
  );
  if (reservedIndex >= 0) {
    return invalid(
      'Это название используется служебной кнопкой.',
      `section-label-${reservedIndex}`,
      'custom',
    );
  }

  const oversizedResponse = findOversizedContentResponse(content);
  if (oversizedResponse) {
    return invalid(
      `Сократите раздел «${oversizedResponse.label}»: ответ длиннее 4000 символов.`,
      oversizedResponse.fieldId,
      oversizedResponse.section,
    );
  }

  return { issues: [], message: '', valid: true };
}

function invalid(
  message: string,
  fieldId: string,
  section: ContentValidationIssue['section'],
): ContentValidationResult {
  return { issues: [{ fieldId, message, section }], message, valid: false };
}
