import { describe, expect, it } from 'vitest';

import {
  ClientInformationCatalog,
  handoffButton,
} from '@/core/application/client-information.js';
import { createTelegramMainKeyboard } from '@/infrastructure/telegram/telegram-client-menu.js';
import {
  buildClientResponsePreviews,
  buildTelegramMenuPreviewRows,
  formatFaqResponse,
} from '@frontend/entities/content/lib/client-response-preview';
import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';
import { createEmptyContent } from '@frontend/entities/content/model/content-draft';

describe('client response preview', () => {
  it('matches the formatted responses produced by the backend catalog', () => {
    const content = createEmptyContent();
    content.schedule = [
      {
        dayTime: 'Пн, 18:00',
        description: 'Для тех, кто начинает с нуля.',
        title: 'Бачата — начинающие',
      },
      { dayTime: 'Ср, 19:00', title: 'Бачата — продолжающие' },
    ];
    content.address = '  ул. Мира, 1  ';
    content.faq = [{ answer: 'Напишите нам.', question: 'Как записаться?' }];
    const catalog = new ClientInformationCatalog({
      address: content.address.trim(),
      faq: content.faq,
      schedule: content.schedule,
      visibleSections: content.visibleSections,
    });

    const previews = buildClientResponsePreviews(content);

    expect(previews.map(({ label, text }) => [label, text])).toEqual(
      catalog
        .getInformationButtons()
        .map((label) => [label, catalog.resolve(label)]),
    );
  });

  it('uses the same button rows as the initial Telegram menu', () => {
    const content = createEmptyContent();
    content.schedule = [{ dayTime: 'Пн, 18:00', title: 'Бачата' }];
    content.prices = 'Пробное — 500 ₽';
    content.address = 'ул. Мира, 1';
    content.faq = [{ answer: 'Напишите нам.', question: 'Как записаться?' }];
    content.customSections = [
      { label: 'Подготовка', text: 'Возьмите сменную обувь.' },
      { label: 'Парковка', text: 'Въезд со двора.' },
      { label: 'Контакты', text: 'Позвоните нам.' },
    ];
    const catalog = new ClientInformationCatalog(content);
    const telegramKeyboard = createTelegramMainKeyboard(catalog, {
      intakePaused: false,
      stage: 'first_contact',
    });
    if (!('keyboard' in telegramKeyboard)) {
      throw new Error('Expected a Telegram keyboard');
    }

    const previewRows = buildTelegramMenuPreviewRows(
      buildClientResponsePreviews(content),
    );

    expect(previewRows).toEqual(
      telegramKeyboard.keyboard.map((row) => row.map((button) => button.text)),
    );
    expect(previewRows.at(-1)).toEqual([handoffButton]);
  });

  it('rejects a FAQ whose final formatted response exceeds the channel limit', () => {
    const content = createEmptyContent();
    content.faq = [
      { answer: 'a'.repeat(3_000), question: 'q'.repeat(300) },
      { answer: 'b'.repeat(700), question: 'Ещё один вопрос' },
    ];

    expect(formatFaqResponse(content.faq).length).toBeGreaterThan(4_000);
    expect(validateContentDraft(content)).toEqual({
      issues: [
        {
          fieldId: 'faq-answer-0',
          message:
            'Сократите раздел «Частые вопросы»: ответ длиннее 4000 символов.',
          section: 'faq',
        },
      ],
      message:
        'Сократите раздел «Частые вопросы»: ответ длиннее 4000 символов.',
      valid: false,
    });
  });

  it('validates hidden responses and reserved custom button names', () => {
    const content = createEmptyContent();
    content.visibleSections = [];
    content.schedule = Array.from({ length: 4 }, (_, index) => ({
      dayTime: `День ${index}`,
      description: 'x'.repeat(1_000),
      title: `Группа ${index}`,
    }));

    expect(validateContentDraft(content).valid).toBe(false);

    content.schedule = [];
    content.customSections = [{ label: ' Задать вопрос ', text: 'Ответ' }];
    expect(validateContentDraft(content)).toEqual({
      issues: [
        {
          fieldId: 'section-label-0',
          message: 'Это название используется служебной кнопкой.',
          section: 'custom',
        },
      ],
      message: 'Это название используется служебной кнопкой.',
      valid: false,
    });
  });
});
