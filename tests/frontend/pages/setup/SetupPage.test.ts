// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import type { SetupStatus } from '@frontend/entities/setup/model/types';
import SetupPage from '@frontend/pages/setup/ui/SetupPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

const disconnectedStatus: SetupStatus = {
  connected: false,
  locked: false,
  source: 'none',
  vk: { connected: false, locked: false, source: 'none' },
};

describe('SetupPage', () => {
  it('shows only channel setup workflows to an authenticated admin', async () => {
    vi.stubGlobal('fetch', createAuthenticatedFetch(disconnectedStatus));

    const wrapper = mount(SetupPage);
    await flushPromises();

    expect(wrapper.get('h1').text()).toBe('Каналы');
    expect(wrapper.get('#telegram-setup-title').text()).toBe('Telegram');
    expect(wrapper.get('#vk-setup-title').text()).toBe('VK');
    expect(wrapper.get('[aria-current="page"]').text()).toBe('Каналы');
    expect(wrapper.text()).toContain('Настройте Long Poll API');
    expect(wrapper.text()).toContain(
      'Ключ даёт доступ к сообщениям сообщества',
    );
    expect(wrapper.text()).not.toContain('Доставка ответов');
    expect(wrapper.text()).not.toContain('Резервная копия');
    expect(wrapper.find('#telegram-token').exists()).toBe(true);
    expect(wrapper.find('#vk-token').exists()).toBe(false);

    wrapper.unmount();
  });

  it('discovers Telegram groups without exposing the token in the page', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.endsWith('/admin/session')) {
        return Promise.resolve(response({ authenticated: true }));
      }
      if (url.endsWith('/setup/status')) {
        return Promise.resolve(response(disconnectedStatus));
      }
      if (url.endsWith('/telegram/discover')) {
        return Promise.resolve(
          response({ chats: [{ id: -1001, isForum: true, title: 'Тест' }] }),
        );
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(SetupPage);
    await flushPromises();
    await wrapper
      .get('#telegram-token')
      .setValue('123456789:synthetic-telegram-token');
    await wrapper.get('.setup-card button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Тест');
    expect(wrapper.text()).not.toContain('synthetic-telegram-token');

    wrapper.unmount();
  });

  it('requires the shared admin login before loading channel status', async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        requestedUrls.push(url);
        if (url.endsWith('/admin/session')) {
          return Promise.resolve(response({ authenticated: false }));
        }
        if (url.endsWith('/admin/login')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/setup/status')) {
          return Promise.resolve(response(disconnectedStatus));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }),
    );

    const wrapper = mount(SetupPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Введите пароль');
    expect(wrapper.find('#telegram-setup-title').exists()).toBe(false);
    expect(requestedUrls).not.toContain('/api/setup/status');

    await wrapper.get('#admin-password').setValue('synthetic-admin-password');
    await wrapper.get('.auth-card').trigger('submit');
    await flushPromises();

    expect(wrapper.get('#telegram-setup-title').text()).toBe('Telegram');
    expect(requestedUrls).toContain('/api/setup/status');

    wrapper.unmount();
  });

  it('uses a single column when only one channel needs setup', async () => {
    vi.stubGlobal(
      'fetch',
      createAuthenticatedFetch({
        connected: true,
        locked: true,
        source: 'local',
        vk: { connected: false, locked: false, source: 'none' },
      }),
    );

    const wrapper = mount(SetupPage);
    await flushPromises();

    expect(wrapper.get('.setup-channel-grid').classes()).toContain(
      'setup-channel-grid--mixed',
    );

    wrapper.unmount();
  });
});

function createAuthenticatedFetch(status: SetupStatus) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.endsWith('/admin/session')) {
      return Promise.resolve(response({ authenticated: true }));
    }
    if (url.endsWith('/setup/status')) {
      return Promise.resolve(response(status));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}
