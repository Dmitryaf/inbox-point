// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { createEmptyContent } from '@frontend/entities/content/model/content-draft';
import ContentSummary from '@frontend/entities/content/ui/ContentSummary.vue';

describe('ContentSummary', () => {
  it('summarizes only client-visible content', () => {
    const content = createEmptyContent();
    content.schedule = [{ dayTime: 'Monday, 19:00', title: 'Beginners' }];
    content.prices = 'Single visit: 10';
    content.visibleSections = ['schedule', 'address', 'faq'];
    content.customSections.push({ label: 'First visit', text: 'Come early.' });

    const wrapper = mount(ContentSummary, { props: { content } });

    expect(wrapper.text()).toContain('Готово к показу');
    expect(wrapper.text()).toContain('1 из 4');
    expect(wrapper.text()).toContain('Свои разделы1');
  });

  it('does not count a fully empty schedule card as ready', () => {
    const content = createEmptyContent();
    content.schedule = [{ dayTime: ' ', description: '', title: '' }];

    const wrapper = mount(ContentSummary, { props: { content } });

    expect(wrapper.text()).toContain('Пока не заполнено');
    expect(wrapper.text()).toContain('0 из 4');
  });

  it('keeps an empty custom section out of the menu and reports invalid fields', async () => {
    const content = createEmptyContent();
    content.address = 'Test address';
    content.customSections = [{ label: '', text: '' }];
    const wrapper = mount(ContentSummary, { props: { content } });

    expect(wrapper.get('summary').text()).toContain('Нужно исправить поля');
    expect(wrapper.get('summary').text()).toContain('Ответов в меню: 1');
    expect(wrapper.text()).toContain('Свои разделы0');
    expect(wrapper.text()).not.toContain('Готово к показу');

    await wrapper.setProps({
      content: {
        ...content,
        customSections: [{ label: 'First visit', text: 'Come early.' }],
      },
    });
    expect(wrapper.get('summary').text()).toContain('Готово к показу');
    expect(wrapper.get('summary').text()).toContain('Ответов в меню: 2');
  });

  it('does not claim readiness for incomplete FAQ or an oversized answer', () => {
    for (const content of [
      { ...createEmptyContent(), faq: [{ question: 'Question', answer: '' }] },
      { ...createEmptyContent(), address: 'x'.repeat(4000) },
    ]) {
      const wrapper = mount(ContentSummary, { props: { content } });
      expect(wrapper.get('summary').text()).toContain('Нужно исправить поля');
    }
  });
});
