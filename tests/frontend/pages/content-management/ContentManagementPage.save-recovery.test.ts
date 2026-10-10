// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { openGroup, groupContent } from './content-management-test-helpers';
import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { mountAppAt } from '@test/frontend/support/mount-app';
import { contentResponse, findButton } from './content-management-test-helpers';

describe('ContentManagementPage save recovery', () => {
  it('keeps edits made while a save request is pending unsaved', async () => {
    const pendingSave = Promise.withResolvers<ReturnType<typeof response>>();
    let submittedScheduleTitle = '';
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
          if (typeof options.body !== 'string') {
            throw new Error('Expected a JSON request body');
          }
          const submitted = JSON.parse(options.body) as {
            content: { groups: { name: string }[] };
          };
          submittedScheduleTitle = submitted.content.groups[0]?.name ?? '';
          return pendingSave.promise;
        }
        return Promise.resolve(contentResponse('Старое расписание'));
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    await openGroup(wrapper);
    await wrapper.get('#group-name-group').setValue('Первое изменение');
    await findButton(wrapper.findAll('button'), 'Сохранить').trigger('click');
    await wrapper.get('#group-name-group').setValue('Второе изменение');
    pendingSave.resolve(
      response({
        content: {
          ...groupContent('Первое изменение', 'Понедельник, 19:00'),
        },
        version: 'b'.repeat(64),
      }),
    );
    await flushPromises();

    expect(submittedScheduleTitle).toBe('Первое изменение');
    expect(
      wrapper.get<HTMLInputElement>('#group-name-group').element.value,
    ).toBe('Второе изменение');
    expect(wrapper.text()).toContain('Есть несохранённые изменения');
  });

  it.each(['save', 'preview'])(
    'preserves an unsaved draft when %s expires the session',
    async (action) => {
      window.sessionStorage.clear();
      window.history.replaceState(null, '', '/manage');
      let authenticated = true;
      let contentLoads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
          const url = requestUrl(input);
          if (url.endsWith('/session')) {
            return Promise.resolve(
              response({ authenticated, mode: 'password' }),
            );
          }
          if (url.endsWith('/login') && options?.method === 'POST') {
            authenticated = true;
            return Promise.resolve(
              response({ authenticated: true, mode: 'password' }),
            );
          }
          if (url.endsWith('/history')) {
            return Promise.resolve(
              response({
                history: [
                  {
                    revision: 2,
                    changedAt: '2026-09-02T12:00:00Z',
                    sections: ['schedule'],
                  },
                  {
                    revision: 1,
                    changedAt: '2026-09-01T12:00:00Z',
                    sections: ['schedule'],
                  },
                ],
              }),
            );
          }
          if (options?.method === 'POST' || url.endsWith('/history/1')) {
            authenticated = false;
            return Promise.resolve(
              response({ message: 'Сессия завершилась.' }, 401),
            );
          }
          contentLoads += 1;
          return Promise.resolve(contentResponse('Старое расписание'));
        }),
      );

      const { router, wrapper } = await mountAppAt('/manage');
      await flushPromises();
      await openGroup(wrapper);
      await wrapper.get('#group-name-group').setValue('Несохранённый черновик');
      if (action === 'save') {
        await findButton(wrapper.findAll('button'), 'Сохранить').trigger(
          'click',
        );
      } else {
        await findButton(wrapper.findAll('button'), 'История').trigger('click');
        await findButton(
          wrapper.findAll('button'),
          'Посмотреть версию',
        ).trigger('click');
      }
      await flushPromises();
      await openGroup(wrapper);

      expect(router.currentRoute.value.path).toBe('/login');
      expect(wrapper.get('h1').text()).toBe('Вход в управление');
      await wrapper.get('input[type="password"]').setValue('owner-password');
      await wrapper.get('form').trigger('submit');
      await flushPromises();
      await openGroup(wrapper);

      expect(
        wrapper.get<HTMLInputElement>('#group-name-group').element.value,
      ).toBe('Несохранённый черновик');
      expect(wrapper.text()).toContain('Есть несохранённые изменения');
      expect(wrapper.text()).toContain('Несохранённый черновик восстановлен.');
      expect(contentLoads).toBe(2);

      wrapper.unmount();
      window.history.replaceState(null, '', '/');
      window.sessionStorage.clear();
    },
  );
});
