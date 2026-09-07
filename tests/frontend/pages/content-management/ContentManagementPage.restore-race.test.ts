// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { findButton, initialVersion } from './content-management-test-helpers';

describe('ContentManagementPage restore concurrency', () => {
  it('keeps edits made while a revision is being restored', async () => {
    const restoreResponse =
      Promise.withResolvers<ReturnType<typeof response>>();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/restore') && options?.method === 'POST') {
          return restoreResponse.promise;
        }
        if (url.endsWith('/history')) {
          return Promise.resolve(
            response({
              history: [
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
              ],
            }),
          );
        }
        return Promise.resolve(
          response({
            content: { schedule: 'Вторник, 20:00' },
            version: initialVersion,
          }),
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
    await findButton(wrapper.findAll('button'), 'Редактирование').trigger(
      'click',
    );
    await wrapper.get('#schedule').setValue('Новая несохранённая правка');

    restoreResponse.resolve(
      response({
        content: { schedule: 'Понедельник, 19:00' },
        version: 'b'.repeat(64),
      }),
    );
    await flushPromises();

    expect(wrapper.get<HTMLTextAreaElement>('#schedule').element.value).toBe(
      'Новая несохранённая правка',
    );
    expect(wrapper.text()).toContain(
      'Ваши новые правки остались в редакторе и ещё не сохранены',
    );
  });
});
