// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import type { SetupStatus } from '@frontend/entities/setup/model/types';
import SetupPage from '@frontend/pages/setup/ui/SetupPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { mountAppAt } from '@test/frontend/support/mount-app';

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

    expect(wrapper.get('#telegram-setup-title').text()).toBe('Telegram');
    expect(wrapper.get('#vk-setup-title').text()).toBe('VK');
    expect(wrapper.text()).not.toContain('Настройте Long Poll API');
    expect(wrapper.text()).toContain('Сначала Telegram');
    expect(wrapper.text()).not.toContain('Доставка ответов');
    expect(wrapper.text()).not.toContain('Резервная копия');
    expect(wrapper.find('#telegram-token').exists()).toBe(false);
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
    await wrapper.get('.setup-toggle').trigger('click');
    await wrapper
      .get('#telegram-token')
      .setValue('123456789:synthetic-telegram-token');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Проверить токен и найти группу')
      ?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Тест');
    expect(wrapper.text()).not.toContain('synthetic-telegram-token');

    wrapper.unmount();
  });

  it('requires the shared admin login before loading channel status', async () => {
    window.history.replaceState(null, '', '/setup');
    window.sessionStorage.clear();
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        requestedUrls.push(url);
        if (url.endsWith('/admin/session')) {
          return Promise.resolve(response({ authenticated: false }));
        }
        if (url.endsWith('/setup/status')) {
          return Promise.resolve(response(disconnectedStatus));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }),
    );

    const { router, wrapper } = await mountAppAt('/setup');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/login');
    expect(wrapper.get('h1').text()).toBe('Вход в управление');
    expect(wrapper.find('#telegram-setup-title').exists()).toBe(false);
    expect(requestedUrls).not.toContain('/api/setup/status');

    wrapper.unmount();
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
  });

  it('opens VK only after Telegram is connected', async () => {
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
    expect(wrapper.text()).toContain('Подключён');
    await wrapper
      .findAll('.setup-toggle')
      .find((button) => button.text() === 'Подключить VK')
      ?.trigger('click');
    expect(wrapper.text()).toContain('Настройте Long Poll API');
    expect(wrapper.text()).toContain(
      '«Дополнительно» → «Работа с API» → «Long Poll API»',
    );
    expect(wrapper.text()).toContain('обязательно поставьте две галочки');
    expect(wrapper.text()).toContain('«Добавить кнопку „Начать“»');
    expect(wrapper.text()).toContain(
      '«Разрешить приложению доступ к управлению сообществом»',
    );
    expect(wrapper.text()).toContain(
      '«Разрешить приложению доступ к сообщениям сообщества»',
    );
    expect(wrapper.text()).not.toContain('Если VK предложит выбрать права');
    expect(wrapper.get('label[for="vk-token"]').text()).toBe(
      'Ключ с правами управления и сообщений',
    );
    wrapper.unmount();
  });
});

function createAuthenticatedFetch(status: SetupStatus) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url.endsWith('/admin/session')) {
      return Promise.resolve(
        response({ authenticated: true, mode: 'password' }),
      );
    }
    if (url.endsWith('/setup/status')) {
      return Promise.resolve(response(status));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}
