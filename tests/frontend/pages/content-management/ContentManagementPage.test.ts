// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { openGroup, groupContent } from './content-management-test-helpers';
import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { findButton, initialVersion } from './content-management-test-helpers';

describe('ContentManagementPage', () => {
  it('loads structured content and exposes an unsaved-change state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/history')) {
          return Promise.resolve(response({ history: [] }));
        }
        return Promise.resolve(
          response({
            content: {
              faq: [{ answer: 'Напишите нам.', question: 'Как записаться?' }],
              ...groupContent('Бачата', 'Понедельник, 19:00'),
            },
            version: initialVersion,
          }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    await openGroup(wrapper);

    expect(
      wrapper.get<HTMLInputElement>('#group-time-group-0').element.value,
    ).toBe('Понедельник, 19:00');
    expect(wrapper.text()).not.toContain('Сохранён старый текст расписания');
    expect(wrapper.get('#faq-question-0').isVisible()).toBe(false);
    expect(wrapper.text()).toContain('Все изменения сохранены');

    await findButton(wrapper.findAll('button'), 'Информация').trigger('click');
    expect(wrapper.get<HTMLInputElement>('#faq-question-0').element.value).toBe(
      'Как записаться?',
    );
    expect(wrapper.get('#group-time-group-0').isVisible()).toBe(false);

    await findButton(wrapper.findAll('button'), 'Занятия').trigger('click');
    await wrapper.get('#group-time-group-0').setValue('Вторник, 20:00');
    await findButton(
      wrapper.findAll('button'),
      'Посмотреть как клиент',
    ).trigger('click');

    expect(wrapper.text()).toContain('Вторник, 20:00');
    expect(wrapper.text()).toContain('Есть несохранённые изменения');
  });
});
