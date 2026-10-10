import { describe, expect, it } from 'vitest';
import { classContent } from '@test/support/class-content.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import {
  renderClassAction,
  resolveClassNavigation,
} from '@/core/application/class-navigation.js';

describe('class schedule without duplicate views', () => {
  it.each([
    ['', 'В какой день хотите прийти?'],
    [
      'Как к вам обращаться и на какое занятие планируете прийти?',
      'В какой день хотите прийти?',
    ],
    ['Удобнее во вторник или в четверг?', 'Удобнее во вторник или в четверг?'],
  ])(
    'asks for the day while preserving a custom question: %s',
    (saved, expected) => {
      const content = classContent();
      content.groups![0]!.applicationQuestion = saved!;
      const response = renderClassAction(
        new ClientInformationCatalog(content),
        'classes:signup:beginners',
      );
      expect(response.text).toContain(expected);
      expect(response.applicationLabel).toBe('Тестовый танец / Начинающие');
      expect(response.beginQuestion).toBe(true);
    },
  );
  it('selects a group before showing its schedule and keeps old time buttons usable', () => {
    const catalog = new ClientInformationCatalog(classContent());
    const direction = renderClassAction(catalog, 'classes:direction:dance:0');
    expect(direction.text).toContain('Выберите группу.');
    expect(direction.text).not.toContain('19:00');
    expect(direction.buttons.map((item) => item.label)).toContain('Начинающие');
    const group = renderClassAction(catalog, 'classes:group:beginners');
    expect(group.text).toContain('19:00');
    expect(group.buttons.some((item) => item.action.includes(':times:'))).toBe(
      false,
    );
    expect(
      renderClassAction(catalog, 'classes:times:beginners').text,
    ).toContain('19:00');
  });
  it('shows every group and original unreviewed source in the all-directions schedule', () => {
    const content = classContent();
    content.groups = [
      ...content.groups!,
      {
        ...content.groups![0]!,
        id: 'review',
        review: { source: 'Исходное расписание\nПятница, 21:00' },
        enrollmentOpen: false,
      },
    ];
    const catalog = new ClientInformationCatalog(content);
    const root = renderClassAction(catalog, 'classes:directions:0');
    const all = root.buttons.find(
      (item) => item.label === 'Расписание всех направлений',
    )!;
    expect(all).toBeDefined();
    const response = renderClassAction(catalog, all.action);
    expect(response.text).toContain('Тестовый танец / Начинающие');
    expect(response.text).toContain('Пятница, 21:00');
    expect(
      response.buttons.some((item) => item.action.includes(':signup:')),
    ).toBe(false);
    expect(
      resolveClassNavigation(catalog, all.command, undefined, {
        stage: 'closed',
        intakePaused: false,
      }),
    ).toEqual(response);
    expect(renderClassAction(catalog, 'classes:review:0').text).toContain(
      'Пятница, 21:00',
    );
  });
  it('paginates long schedules losslessly and offers usable commands on each page', () => {
    const content = classContent();
    content.groups![0]!.review = {
      source: ' '.repeat(2999) + '💃' + 'Исходный текст '.repeat(100),
    };
    content.groups![0]!.enrollmentOpen = false;
    const catalog = new ClientInformationCatalog(content);
    let action = 'classes:all:0';
    let combined = '';
    for (let page = 0; page < 10; page++) {
      const response = renderClassAction(catalog, action);
      expect(response.text.length).toBeLessThan(4000);
      combined += response.text.replace('Расписание всех направлений\n\n', '');
      const next = response.buttons.find((item) => item.label === 'Далее');
      if (!next) {
        break;
      }
      expect(
        resolveClassNavigation(catalog, next.command, undefined, {
          stage: 'closed',
          intakePaused: false,
        }),
      ).toEqual(renderClassAction(catalog, next.action));
      action = next.action;
    }
    expect(combined).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u);
    expect(combined).toBe(
      catalog.resolve('Расписание')!.replace('Расписание\n\n', ''),
    );
  });
});
