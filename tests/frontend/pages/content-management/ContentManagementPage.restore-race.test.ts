// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { openGroup, groupContent } from './content-management-test-helpers';
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
            content: {
              ...groupContent('Бачата', 'Вторник, 20:00'),
            },
            version: initialVersion,
          }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    await openGroup(wrapper);
    await findButton(wrapper.findAll('button'), 'История').trigger('click');
    await flushPromises();
    await openGroup(wrapper);
    await findButton(wrapper.findAll('button'), 'Посмотреть версию').trigger(
      'click',
    );
    await flushPromises();
    await openGroup(wrapper);
    await findButton(wrapper.findAll('button'), 'Да, восстановить').trigger(
      'click',
    );
    await findButton(wrapper.findAll('button'), 'Редактирование').trigger(
      'click',
    );
    await openGroup(wrapper);
    await wrapper
      .get('#group-name-group')
      .setValue('Новая несохранённая правка');

    restoreResponse.resolve(
      response({
        content: {
          ...groupContent('Бачата', 'Понедельник, 19:00'),
        },
        version: 'b'.repeat(64),
      }),
    );
    await flushPromises();
    await openGroup(wrapper);

    expect(
      wrapper.get<HTMLInputElement>('#group-name-group').element.value,
    ).toBe('Новая несохранённая правка');
    expect(wrapper.text()).toContain(
      'Ваши новые правки остались в редакторе и ещё не сохранены',
    );
  });
});
