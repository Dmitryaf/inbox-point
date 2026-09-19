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
});
