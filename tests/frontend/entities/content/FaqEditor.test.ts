// @vitest-environment jsdom

import { mount } from '@test/frontend/support/react-test-utils';
import { describe, expect, it } from 'vitest';

import { createEmptyContent } from '@frontend/entities/content/model/content-draft';
import FaqEditor from '@frontend/entities/content/ui/FaqEditor';

describe('FaqEditor', () => {
  it('keeps only relevant actions for each question', () => {
    const content = createEmptyContent();
    content.faq.push({
      answer: 'Напишите нам.',
      question: 'Как записаться?',
    });

    const wrapper = mount(FaqEditor, {
      props: { modelValue: content },
    });
    const labels = wrapper.findAll('button').map((button) => button.text());

    expect(labels).toEqual(['Удалить', 'Добавить вопрос']);
  });
});
