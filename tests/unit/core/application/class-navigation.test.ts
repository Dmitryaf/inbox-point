import { describe, expect, it } from 'vitest';
import { classContent } from '@test/support/class-content.js';
import {
  ClientInformationCatalog,
  reservedClientLabels,
} from '@/core/application/client-information.js';
import { classContentIssue } from '@/core/application/class-content.js';
import {
  renderClassAction,
  resolveClassNavigation,
  classTextFallback,
} from '@/core/application/class-navigation.js';

describe('class catalog and navigation', () => {
  it('opens an exact normalized phrase or direction without matching a sentence', () => {
    const catalog = new ClientInformationCatalog(classContent());
    const state = { stage: 'closed', intakePaused: false } as const;
    expect(
      resolveClassNavigation(catalog, '  ТЕСТОВЫЙ   танец  ', undefined, state)
        ?.text,
    ).toContain('Начинающие');
    expect(
      resolveClassNavigation(catalog, 'Хочу тестовый танец', undefined, state),
    ).toBeUndefined();
    expect(
      resolveClassNavigation(
        catalog,
        'Все группы',
        undefined,
        state,
      )?.buttons.map((item) => item.label),
    ).toContain('Начинающие');
    expect(catalog.getInformationButtons()).not.toContain('Тестовый танец');
    expect(
      resolveClassNavigation(catalog, 'Тестовый танец', 'address', state),
    ).toBeUndefined();
  });
  it.each(['active', 'awaiting_question'] as const)(
    'leaves keyword messages with the %s conversation',
    (stage) => {
      const catalog = new ClientInformationCatalog(classContent());
      expect(
        resolveClassNavigation(catalog, 'Тестовый танец', undefined, {
          stage,
          intakePaused: false,
        }),
      ).toBeUndefined();
      expect(
        resolveClassNavigation(catalog, '', 'classes:group:beginners', {
          stage,
          intakePaused: false,
        })?.text,
      ).toContain('Начинающие');
    },
  );
  it('reuses schedule and target IDs after renaming and editing, and refuses deleted targets', () => {
    const content = classContent();
    const catalog = new ClientInformationCatalog(content);
    content.groups![0]!.name = 'Новая группа';
    content.groups![0]!.meetings[0] = 'Понедельник, 20:00';
    catalog.replace(content);
    expect(
      resolveClassNavigation(catalog, 'Тестовый танец', undefined, {
        stage: 'first_contact',
        intakePaused: false,
      })?.text,
    ).toContain('Новая группа');
    expect(
      renderClassAction(catalog, 'classes:times:beginners').text,
    ).toContain('20:00');
    expect(
      renderClassAction(catalog, 'classes:group:beginners').text,
    ).toContain('20:00');
    expect(renderClassAction(catalog, 'classes:group:deleted').buttons).toEqual(
      [expect.objectContaining({ action: 'main' })],
    );
    content.groups = [];
    expect(classContentIssue(content, reservedClientLabels)).toBeDefined();
  });
  it('uses shared prices and offers a contextual application only when enrollment is open', () => {
    const content = classContent();
    const catalog = new ClientInformationCatalog(content);
    const signup = renderClassAction(catalog, 'classes:signup:beginners');
    expect(signup).toMatchObject({
      beginQuestion: true,
      applicationLabel: 'Тестовый танец / Начинающие',
    });
    expect(signup.text).toContain('Когда хотите прийти?');
    expect(
      renderClassAction(catalog, 'classes:prices:beginners').text,
    ).toContain('500');
    content.groups![0]!.enrollmentOpen = false;
    catalog.replace(content);
    expect(
      renderClassAction(catalog, 'classes:group:beginners').buttons.some(
        (item) => item.action.includes('signup'),
      ),
    ).toBe(false);
    expect(
      renderClassAction(catalog, 'classes:signup:beginners').beginQuestion,
    ).toBeUndefined();
    expect(
      renderClassAction(catalog, 'classes:times:beginners').text,
    ).toContain('Четверг');
    expect(
      renderClassAction(catalog, 'classes:group:beginners', {
        stage: 'closed',
        intakePaused: true,
      }).buttons.some((item) => item.action.includes('question')),
    ).toBe(false);
  });
  it.each([
    'Меню',
    ' ЦЕны ',
    '/start',
    'Записаться на занятие',
    'Другие направления',
    'Направление: Тест',
  ])('rejects a reserved keyword %s', (phrase) => {
    const content = classContent();
    content.keywords = [{ phrase, targetType: 'group', targetId: 'beginners' }];
    expect(classContentIssue(content, reservedClientLabels)).toBeDefined();
  });
  it('rejects duplicate phrases, names and unknown relationships', () => {
    const content = classContent();
    content.keywords = [
      ...content.keywords!,
      { phrase: 'ТЕСТОВЫЙ  танец', targetType: 'direction', targetId: 'dance' },
    ];
    expect(classContentIssue(content, reservedClientLabels)).toContain(
      'уже используется',
    );
    content.keywords = [];
    content.groups![0]!.directionId = 'missing';
    expect(classContentIssue(content, reservedClientLabels)).toBeDefined();
  });
  it('keeps a bounded paginated keyboard and every fallback command usable after restart', () => {
    const content = classContent();
    content.directions = Array.from({ length: 20 }, (_, index) => ({
      id: 'dir' + index,
      name: 'Направление ' + index,
    }));
    content.groups = Array.from({ length: 60 }, (_, index) => ({
      ...classContent().groups![0]!,
      id: 'group' + index,
      directionId: 'dir0',
      name: 'Группа ' + index,
      meetings: Array.from({ length: 7 }, () => 'Вторник, 20:00'),
    }));
    content.keywords = [];
    const catalog = new ClientInformationCatalog(content);
    for (const action of [
      'classes:directions:0',
      'classes:directions:3',
      'classes:direction:dir0:4',
      'classes:group:group0',
      'classes:times:group0',
    ]) {
      const response = renderClassAction(catalog, action);
      expect(response.text.length).toBeLessThanOrEqual(4000);
      expect(response.buttons.length).toBeLessThanOrEqual(6);
      expect(classTextFallback(response)).toContain('Кнопки недоступны');
      for (const item of response.buttons.filter(
        (button) => button.action !== 'main',
      )) {
        expect(Buffer.byteLength(item.action)).toBeLessThanOrEqual(64);
        expect(
          resolveClassNavigation(
            new ClientInformationCatalog(content),
            item.command,
            undefined,
            { stage: 'closed', intakePaused: false },
          ),
        ).toBeDefined();
      }
    }
  });
});
