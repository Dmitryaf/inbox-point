// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { findButton, initialVersion } from './content-management-test-helpers';

const savedVersion = 'b'.repeat(64);

describe('ContentManagementPage restore', () => {
  it('restores an earlier revision and reloads the editor', async () => {
    let schedule = 'Вторник, 20:00';
    let restored = false;
    const history = [
      {
        changedAt: '2026-09-02T12:00:00.000Z',
        revision: 2,
        sections: ['schedule'],
      },
      {
        changedAt: '2026-09-01T12:00:00.000Z',
        revision: 1,
        sections: ['schedule'],
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/restore') && options?.method === 'POST') {
          schedule = 'Понедельник, 19:00';
          restored = true;
          return Promise.resolve(
            response({ content: { schedule }, version: savedVersion }),
          );
        }
        if (url.endsWith('/history')) {
          if (restored) {
            return Promise.resolve(
              response({ message: 'История временно недоступна.' }, 500),
            );
          }
          return Promise.resolve(response({ history }));
        }
        return Promise.resolve(
          response({ content: { schedule }, version: initialVersion }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    await findButton(wrapper.findAll('button'), 'История').trigger('click');
    await flushPromises();
    await findButton(wrapper.findAll('button'), 'Восстановить').trigger(
      'click',
    );
    await findButton(wrapper.findAll('button'), 'Да, восстановить').trigger(
      'click',
    );
    await flushPromises();
    await findButton(wrapper.findAll('button'), 'Редактирование').trigger(
      'click',
    );

    expect(wrapper.get<HTMLTextAreaElement>('#schedule').element.value).toBe(
      'Понедельник, 19:00',
    );
    expect(wrapper.text()).toContain('Предыдущая версия восстановлена');
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Версия восстановлена, но историю изменений сейчас открыть нельзя. Попробуйте обновить страницу позже.',
    );
  });
});
