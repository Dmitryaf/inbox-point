// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

const initialVersion = 'a'.repeat(64);
const savedVersion = 'b'.repeat(64);

describe('ContentManagementPage channel button notice', () => {
  it('explains when clients receive updated channel buttons', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/history')) {
          return Promise.resolve(response({ history: [] }));
        }
        if (options?.method === 'POST') {
          return Promise.resolve(
            response({
              content: { schedule: 'Новое расписание' },
              version: savedVersion,
            }),
          );
        }
        return Promise.resolve(
          response({
            content: { schedule: 'Старое расписание' },
            version: initialVersion,
          }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    await wrapper.get('#schedule').setValue('Новое расписание');
    const saveButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Сохранить');
    if (!saveButton) {
      throw new Error('Expected a save button');
    }
    await saveButton.trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="status"]').text()).toContain(
      'Кнопки обновятся, когда бот отправит клиенту следующее сообщение',
    );
    expect(wrapper.get('[role="status"]').text()).toContain(
      'нажать «Начать» в VK',
    );
  });
});
