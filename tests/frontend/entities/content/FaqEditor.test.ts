// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { createEmptyContent } from '@frontend/entities/content/model/content-draft';
import FaqEditor from '@frontend/entities/content/ui/FaqEditor.vue';

describe('FaqEditor', () => {
  it('moves questions with accessible boundary controls', async () => {
    const content = createEmptyContent();
    content.faq.push(
      { answer: 'Напишите нам.', question: 'Как записаться?' },
      { answer: 'По будням.', question: 'Когда вы работаете?' },
    );

    const wrapper = mount(FaqEditor, {
      props: { modelValue: content },
    });
    const moveFirstUp = wrapper.get('[aria-label="Переместить вопрос 1 выше"]');
    const moveFirstDown = wrapper.get(
      '[aria-label="Переместить вопрос 1 ниже"]',
    );

    expect(moveFirstUp.attributes('disabled')).toBeDefined();
    expect(
      wrapper
        .get('[aria-label="Переместить вопрос 2 ниже"]')
        .attributes('disabled'),
    ).toBeDefined();

    await moveFirstDown.trigger('click');

    expect(content.faq.map((item) => item.question)).toEqual([
      'Когда вы работаете?',
      'Как записаться?',
    ]);
  });
});
