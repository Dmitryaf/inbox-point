// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import App from '@frontend/app/App.vue';
import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { contentResponse, findButton } from './content-management-test-helpers';

describe('ContentManagementPage save recovery', () => {
  it('keeps edits made while a save request is pending unsaved', async () => {
    const pendingSave = Promise.withResolvers<ReturnType<typeof response>>();
    let submittedSchedule = '';
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
            content: { schedule: string };
          };
          submittedSchedule = submitted.content.schedule;
          return pendingSave.promise;
        }
        return Promise.resolve(contentResponse('Старое расписание'));
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    await wrapper.get('#schedule').setValue('Первое изменение');
    await findButton(wrapper.findAll('button'), 'Сохранить').trigger('click');
    await wrapper.get('#schedule').setValue('Второе изменение');
    pendingSave.resolve(
      response({
        content: { schedule: 'Первое изменение' },
        version: 'b'.repeat(64),
      }),
    );
    await flushPromises();

    expect(submittedSchedule).toBe('Первое изменение');
    expect(wrapper.get<HTMLTextAreaElement>('#schedule').element.value).toBe(
      'Второе изменение',
    );
    expect(wrapper.text()).toContain('Есть несохранённые изменения');
  });

  it('preserves an unsaved draft across session renewal', async () => {
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/manage');
    let authenticated = true;
    let contentLoads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated }));
        }
        if (url.endsWith('/login') && options?.method === 'POST') {
          authenticated = true;
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/history')) {
          return Promise.resolve(response({ history: [] }));
        }
        if (options?.method === 'POST') {
          authenticated = false;
          return Promise.resolve(
            response({ message: 'Сессия завершилась.' }, 401),
          );
        }
        contentLoads += 1;
        return Promise.resolve(contentResponse('Старое расписание'));
      }),
    );

    const wrapper = mount(App);
    await flushPromises();
    await wrapper.get('#schedule').setValue('Несохранённый черновик');
    await findButton(wrapper.findAll('button'), 'Сохранить').trigger('click');
    await flushPromises();

    expect(window.location.pathname).toBe('/login');
    expect(wrapper.get('h1').text()).toBe('Вход в управление');
    await wrapper.get('input[type="password"]').setValue('owner-password');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get<HTMLTextAreaElement>('#schedule').element.value).toBe(
      'Несохранённый черновик',
    );
    expect(wrapper.text()).toContain('Есть несохранённые изменения');
    expect(wrapper.text()).toContain('Несохранённый черновик восстановлен.');
    expect(contentLoads).toBe(2);

    wrapper.unmount();
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
  });
});
