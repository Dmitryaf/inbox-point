import { describe, expect, it } from 'vitest';
import { classContent } from '@test/support/class-content.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { resolveClassNavigation } from '@/core/application/class-navigation.js';
import type { ClientConversationStage } from '@/core/model/client-conversation.js';

describe('explicit class keywords', () => {
  it.each<ClientConversationStage>([
    'first_contact',
    'closed',
    'active',
    'awaiting_question',
  ])(
    'never resolves a direction or group name without a keyword in %s',
    (stage) => {
      const content = classContent();
      content.keywords = [];
      const catalog = new ClientInformationCatalog(content);
      for (const text of ['Тестовый танец', 'Начинающие']) {
        expect(
          resolveClassNavigation(catalog, text, undefined, {
            stage,
            intakePaused: false,
          }),
        ).toBeUndefined();
      }
    },
  );
  it('resolves only an exact configured phrase during an active request', () => {
    const catalog = new ClientInformationCatalog(classContent());
    const state = { stage: 'active', intakePaused: false } as const;
    expect(
      resolveClassNavigation(catalog, ' ТЕСТОВЫЙ  ТАНЕЦ ', undefined, state)
        ?.actionKey,
    ).toBe('group:beginners');
    expect(
      resolveClassNavigation(catalog, 'Хочу тестовый танец', undefined, state),
    ).toBeUndefined();
    expect(
      resolveClassNavigation(catalog, 'Тестовый танец', undefined, {
        ...state,
        awaitingQuestion: true,
      }),
    ).toBeUndefined();
  });
});
