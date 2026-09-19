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
  if (content.schedule.length > 20) {
    return invalid(
      'Оставьте не больше 20 направлений в расписании.',
      'schedule-title-20',
      'core',
    );
  }
  const oversizedScheduleIndex = content.schedule.findIndex(
    (item) =>
      item.title.length > 120 ||
      item.dayTime.length > 120 ||
      (item.description?.length ?? 0) > 1_000,
  );
  if (oversizedScheduleIndex >= 0) {
    const item = content.schedule[oversizedScheduleIndex]!;
    const field =
      item.title.length > 120
        ? 'title'
        : item.dayTime.length > 120
          ? 'day-time'
          : 'description';
    return invalid(
      'Сократите это поле расписания.',
      `schedule-${field}-${oversizedScheduleIndex}`,
      'core',
    );
  }
  const incompleteScheduleIndex = content.schedule.findIndex((item) => {
    const hasValue = Boolean(
      item.title.trim() || item.dayTime.trim() || item.description?.trim(),
    );
    return hasValue && (!item.title.trim() || !item.dayTime.trim());
  });
  if (incompleteScheduleIndex >= 0) {
    const item = content.schedule[incompleteScheduleIndex]!;
    return invalid(
      'Заполните направление / группу и день / время в этой карточке.',
      item.title.trim()
        ? `schedule-day-time-${incompleteScheduleIndex}`
        : `schedule-title-${incompleteScheduleIndex}`,
      'core',
    );
  }

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
