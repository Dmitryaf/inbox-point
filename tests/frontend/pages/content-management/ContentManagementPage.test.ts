// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

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
              schedule: 'Понедельник, 19:00',
            },
            version: initialVersion,
          }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();

    expect(wrapper.get<HTMLTextAreaElement>('#schedule').element.value).toBe(
      'Понедельник, 19:00',
    );
    expect(wrapper.text()).not.toContain('Как записаться?');
    expect(wrapper.text()).toContain('Все изменения сохранены');

    await findButton(wrapper.findAll('button'), 'Частые вопросы').trigger(
      'click',
    );
    expect(wrapper.get<HTMLInputElement>('#faq-question-0').element.value).toBe(
      'Как записаться?',
    );
    expect(wrapper.find('#schedule').exists()).toBe(false);

    await findButton(wrapper.findAll('button'), 'Основное').trigger('click');
    await wrapper.get('#schedule').setValue('Вторник, 20:00');
    await findButton(wrapper.findAll('button'), 'Предпросмотр').trigger(
      'click',
    );

    expect(wrapper.text()).toContain('Вторник, 20:00');
    expect(wrapper.text()).toContain('Есть несохранённые изменения');
  });
});
