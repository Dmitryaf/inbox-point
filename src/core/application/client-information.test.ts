import { describe, expect, it } from 'vitest';

import {
  addressButton,
  ClientInformationCatalog,
  pricesButton,
  scheduleButton,
} from './client-information.js';

describe('client information', () => {
  it.each([
    [scheduleButton, 'Расписание'],
    [pricesButton, 'ценах'],
    [addressButton, 'адресе'],
  ])('resolves %s from the canonical catalog', (button, expected) => {
    const catalog = new ClientInformationCatalog();
    expect(catalog.resolve(button)).toContain(expected);
  });

  it('does not treat unknown customer text as reference information', () => {
    const catalog = new ClientInformationCatalog();
    expect(catalog.resolve('У меня другой вопрос')).toBeUndefined();
  });

  it('formats list sections without inventing missing values', () => {
    const catalog = new ClientInformationCatalog();
    catalog.replace({
      prices: 'Разовое занятие — 500 ₽\n- Абонемент — 3200 ₽',
      schedule: 'Понедельник, 19:00\nПятница, 20:00',
    });

    expect(catalog.resolve(scheduleButton)).toBe(
      'Расписание\n\n• Понедельник, 19:00\n• Пятница, 20:00',
    );
    expect(catalog.resolve(pricesButton)).toBe(
      'Цены\n\n• Разовое занятие — 500 ₽\n• Абонемент — 3200 ₽',
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

  it('formats FAQ pairs with visible questions and separators', () => {
    const catalog = new ClientInformationCatalog({
      customSections: [
        {
          format: 'faq',
          label: 'FAQ',
          text: 'Как записаться?\nНапишите преподавателю.\n\nЧто взять?\nСменную обувь.',
        },
      ],
    });

    expect(catalog.resolve('FAQ')).toBe(
      'FAQ\n\n❓ Как записаться?\nНапишите преподавателю.\n\n────────\n\n❓ Что взять?\nСменную обувь.',
    );
  });

  it('rejects an FAQ question without an answer', () => {
    expect(
      () =>
        new ClientInformationCatalog({
          customSections: [
            { format: 'faq', label: 'FAQ', text: 'Как записаться?' },
          ],
        }),
    ).toThrow('Invalid custom information sections');
  });
});
