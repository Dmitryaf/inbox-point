// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { createEmptyContent } from '@frontend/entities/content/model/content-draft';
import ContentPreview from '@frontend/widgets/content-preview/ui/ContentPreview.vue';

describe('ContentPreview', () => {
  it('shows the client menu and replies in their real order', () => {
    const content = createEmptyContent();
    content.schedule = 'Понедельник, 19:00';
    content.customSections = [
      { label: 'Подготовка', text: 'Возьмите сменную обувь.' },
    ];

    const wrapper = mount(ContentPreview, { props: { content } });
    const menu = wrapper.get('.message-preview-buttons');
    const buttons = menu.findAll('span').map((item) => item.text());

    expect(wrapper.get('h2').text()).toBe('Так клиент увидит ваши ответы');
    expect(buttons).toEqual(['Расписание', 'Подготовка', 'Задать вопрос']);
    expect(wrapper.findAll('.preview-client-message')[0]?.text()).toBe(
      'Расписание',
    );
    expect(wrapper.findAll('.preview-service-message')[0]?.text()).toContain(
      'Понедельник, 19:00',
    );
  });
});
