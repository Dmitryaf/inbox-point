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

  it('replaces unavailable values without inventing missing sections', () => {
    const catalog = new ClientInformationCatalog();
    catalog.replace({ schedule: 'Понедельник, 19:00' });

    expect(catalog.resolve(scheduleButton)).toBe('Понедельник, 19:00');
    expect(catalog.resolve(pricesButton)).toContain('пока не добавлено');
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
});
