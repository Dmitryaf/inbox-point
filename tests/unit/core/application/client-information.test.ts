import { describe, expect, it } from 'vitest';

import {
  addressButton,
  ClientInformationCatalog,
  faqButton,
  formatScheduleResponse,
  handoffButton,
  isHandoffRequest,
  pricesButton,
  scheduleButton,
} from '@/core/application/client-information.js';
import {
  formatScheduleCompatibilityResponse,
  formatScheduleCompatibilityText,
} from '@/core/application/schedule-response.js';

describe('client information', () => {
  it('lists only information buttons with configured content', () => {
    const catalog = new ClientInformationCatalog({
      address: 'Main street, 1',
      faq: [
        {
          answer: 'Напишите нам.',
          question: 'Как записаться?',
        },
      ],
    });

    expect(catalog.getInformationButtons()).toEqual([addressButton, faqButton]);
    expect(new ClientInformationCatalog().getInformationButtons()).toEqual([]);
  });

  it('keeps hidden section content without exposing its menu button', () => {
    const catalog = new ClientInformationCatalog({
      address: 'Main street, 1',
      prices: 'Single visit: 10',
      schedule: [{ dayTime: 'Monday: 19:00', title: 'Beginners' }],
      visibleSections: ['address', 'schedule'],
    });

    expect(catalog.getInformationButtons()).toEqual([
      scheduleButton,
      addressButton,
    ]);
    expect(catalog.resolve(pricesButton)).toContain('Single visit: 10');
  });

  it.each([
    [scheduleButton, 'Расписание пока не указано.'],
    [pricesButton, 'Цены пока не указаны.'],
    [addressButton, 'Адрес пока не указан.'],
    [faqButton, 'Раздел с частыми вопросами пока пуст.'],
  ])('resolves %s from the canonical catalog', (button, expected) => {
    const catalog = new ClientInformationCatalog();
    expect(catalog.resolve(button)).toBe(expected);
  });

  it('does not treat unknown customer text as reference information', () => {
    const catalog = new ClientInformationCatalog();
    expect(catalog.resolve('У меня другой вопрос')).toBeUndefined();
  });

  it('formats structured schedule items and omits an empty description', () => {
    const catalog = new ClientInformationCatalog();
    catalog.replace(
      {
        prices: 'Разовое занятие — 500 ₽\n- Абонемент — 3200 ₽',
        schedule: [
          {
            dayTime: 'Пн / Ср, 19:00',
            description: 'Подходит начинающим.',
            title: 'Бачата — начинающие',
          },
          { dayTime: 'Пятница, 20:00', title: 'Бачата — продолжающие' },
        ],
      },
      [],
    );

    expect(catalog.resolve(scheduleButton)).toBe(
      'Расписание\n\nБачата — начинающие\nПн / Ср, 19:00\nПодходит начинающим.\n\nБачата — продолжающие\nПятница, 20:00',
    );
    expect(catalog.resolve(pricesButton)).toBe(
      'Цены\n\n• Разовое занятие — 500 ₽\n• Абонемент — 3200 ₽',
    );
  });

  it('keeps a legacy schedule available without interpreting its text', () => {
    const catalog = new ClientInformationCatalog({
      legacySchedule: 'Свободный старый текст\n- без известной структуры',
    });

    expect(catalog.resolve(scheduleButton)).toBe(
      'Расписание\n\n• Свободный старый текст\n• без известной структуры',
    );
  });

  it('resolves custom sections and protects its internal copy', () => {
    const source = [
      { label: 'Первое занятие', text: 'Приходите за 10 минут.' },
    ];
    const catalog = new ClientInformationCatalog({ customSections: source });
    source[0]!.text = 'Changed outside';

    expect(catalog.resolve('Первое занятие')).toBe('Приходите за 10 минут.');
    expect(catalog.getCustomSections()).toEqual([
      { label: 'Первое занятие', text: 'Приходите за 10 минут.' },
    ]);
  });

  it('recognizes historical actions while giving current actions priority', () => {
    const catalog = new ClientInformationCatalog(
      {
        customSections: [{ label: 'Цены занятий', text: 'Текущий ответ.' }],
      },
      ['Стоимость', 'Абонементы'],
    );

    expect(catalog.isStaleMenuAction(' Абонементы ')).toBe(true);
    expect(catalog.isStaleMenuAction('Стоимость')).toBe(true);
    expect(catalog.isStaleMenuAction('Цены занятий')).toBe(false);
    expect(catalog.isStaleMenuAction('Обычный вопрос')).toBe(false);

    catalog.replace(
      {
        customSections: [{ label: 'Абонементы', text: 'Снова текущий ответ.' }],
      },
      ['Цены занятий', 'Стоимость'],
    );

    expect(catalog.isStaleMenuAction('Абонементы')).toBe(false);
    expect(catalog.isStaleMenuAction('Цены занятий')).toBe(true);
  });

  it('restores stale-menu recognition from persisted content history', () => {
    const catalog = new ClientInformationCatalog(
      {
        customSections: [
          { label: 'Расписание занятий', text: 'В понедельник.' },
        ],
      },
      ['Расписание группы'],
    );

    expect(catalog.isStaleMenuAction('Расписание группы')).toBe(true);
  });

  it('formats FAQ pairs with visible questions and separators', () => {
    const catalog = new ClientInformationCatalog({
      faq: [
        {
          answer: 'Напишите нам.',
          question: 'Как записаться?',
        },
        {
          answer: 'Сменную обувь.',
          question: 'Что взять?',
        },
      ],
    });

    expect(catalog.resolve(faqButton)).toBe(
      'Частые вопросы\n\n❓ Как записаться?\nНапишите нам.\n\n────────\n\n❓ Что взять?\nСменную обувь.',
    );
  });

  it('accepts only the current FAQ label', () => {
    const catalog = new ClientInformationCatalog({
      faq: [{ answer: 'Напишите нам.', question: 'Как записаться?' }],
    });

    expect(catalog.resolve('FAQ')).toBeUndefined();
  });

  it('accepts only the current handoff label', () => {
    expect(isHandoffRequest(handoffButton)).toBe(true);
    expect(isHandoffRequest('Написать оператору')).toBe(false);
    expect(isHandoffRequest('Передать сообщение человеку')).toBe(false);
    expect(isHandoffRequest('Задать вопрос оператору')).toBe(false);
  });

  it('rejects an FAQ question without an answer', () => {
    expect(
      () =>
        new ClientInformationCatalog({
          faq: [{ answer: '', question: 'Как записаться?' }],
        }),
    ).toThrow('Invalid FAQ items');
  });

  it('rejects a schedule whose formatted response exceeds the limit', () => {
    const schedule = Array.from({ length: 5 }, (_, index) => ({
      dayTime: `День ${index}`,
      description: 'a'.repeat(800),
      title: `Группа ${index}`,
    }));

    expect(() => new ClientInformationCatalog({ schedule })).toThrow();
  });

  it('keeps structured and compatibility responses within 4000 characters', () => {
    const schedule = Array.from({ length: 5 }, (_, index) => ({
      dayTime: `День ${index}`,
      description: 'a'.repeat(750),
      title: `Группа ${index}`,
    }));
    schedule[0]!.description += 'a'.repeat(
      4_000 - formatScheduleResponse(schedule).length,
    );

    expect(formatScheduleResponse(schedule)).toHaveLength(4_000);
    expect(
      formatScheduleCompatibilityResponse(schedule).length,
    ).toBeGreaterThan(4_000);
    expect(() => new ClientInformationCatalog({ schedule })).toThrow();

    const compatibilityOverflow =
      formatScheduleCompatibilityResponse(schedule).length - 4_000;
    schedule[0]!.description = schedule[0]!.description.slice(
      0,
      -compatibilityOverflow,
    );

    expect(formatScheduleCompatibilityResponse(schedule)).toHaveLength(4_000);
    expect(() => new ClientInformationCatalog({ schedule })).not.toThrow();
    const compatibilityResponse = new ClientInformationCatalog({
      legacySchedule: formatScheduleCompatibilityText(schedule),
    }).resolve(scheduleButton);
    expect(compatibilityResponse?.length).toBeLessThanOrEqual(4_000);
  });
});
