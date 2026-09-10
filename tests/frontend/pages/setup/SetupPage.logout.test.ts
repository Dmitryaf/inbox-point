// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import App from '@frontend/app/App.vue';
import type { SetupStatus } from '@frontend/entities/setup/model/types';
import { requestUrl, response } from '@test/frontend/support/fake-response';

const disconnectedStatus: SetupStatus = {
  connected: false,
  locked: false,
  source: 'none',
  vk: { connected: false, locked: false, source: 'none' },
};

describe('SetupPage logout', () => {
  it('leaves the previous page and opens the dedicated login route', async () => {
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/setup');
    let authenticated = true;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/admin/session')) {
          return Promise.resolve(response({ authenticated }));
        }
        if (url.endsWith('/setup/status')) {
          return Promise.resolve(response(disconnectedStatus));
        }
        if (url.endsWith('/admin/logout') && options?.method === 'POST') {
          authenticated = false;
          return Promise.resolve(response({ authenticated: false }));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }),
    );

    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.get('h1').text()).toBe('Каналы');

    const logoutButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Выйти');
    expect(logoutButton).toBeDefined();
    await logoutButton?.trigger('click');
    await flushPromises();

    expect(window.location.pathname).toBe('/login');
    expect(document.title).toBe('Вход в управление — Messenger Handoff');
    expect(wrapper.get('h1').text()).toBe('Вход в управление');
    expect(wrapper.text()).not.toContain('Каналы');
    expect(wrapper.find('#admin-password').exists()).toBe(true);

    wrapper.unmount();
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
  });
});
