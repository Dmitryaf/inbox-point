// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import SetupPage from '@frontend/pages/setup/ui/SetupPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

describe('SetupPage disconnect', () => {
  it('disconnects VK before Telegram and preserves request history', async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/admin/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/setup/status')) {
          return Promise.resolve(response(localStatus));
        }
        if (url.endsWith('/telegram/discover')) {
          return Promise.resolve(
            response({
              chats: [{ id: -2002, isForum: true, title: 'Support' }],
            }),
          );
        }
        if (options?.method === 'DELETE') {
          return Promise.resolve(response({ connected: false }));
        }
        if (options?.method === 'POST') {
          return Promise.resolve(response({ connected: true }));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(SetupPage);
    await flushPromises();
    for (const toggle of wrapper.findAll('.setup-toggle')) {
      await toggle.trigger('click');
    }
    const telegramDisconnect = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отключить Telegram');
    expect(telegramDisconnect?.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('сначала отключите VK');

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отключить VK')
      ?.trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/setup/vk',
      expect.objectContaining({ method: 'DELETE' }),
    );
    const vkDisconnectOptions = fetchMock.mock.calls.find(
      ([input, options]) =>
        requestUrl(input).endsWith('/setup/vk') && options?.method === 'DELETE',
    )?.[1];
    expect(vkDisconnectOptions?.body).toBeUndefined();
    expect(vkDisconnectOptions?.headers).toBeUndefined();
    expect(confirmMock).toHaveBeenCalledWith(
      expect.stringContaining('История обращений сохранится'),
    );
    expect(telegramDisconnect?.attributes('disabled')).toBeUndefined();

    await telegramDisconnect?.trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/setup/telegram',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(wrapper.findAll('.status-pill').map((pill) => pill.text())).toEqual([
      'Не подключён',
      'Не подключён',
    ]);

    await wrapper
      .get('#telegram-token')
      .setValue('replacement-synthetic-telegram-token');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Проверить токен и найти группу')
      ?.trigger('click');
    await flushPromises();
    await wrapper.get('input[type="radio"]').setValue(true);
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Подключить Telegram')
      ?.trigger('click');
    await flushPromises();

    await wrapper.get('#vk-community').setValue('https://vk.com/replacement');
    await wrapper.get('#vk-token').setValue('replacement-synthetic-vk-token');
    await wrapper.get('form.setup-form').trigger('submit');
    await flushPromises();

    expect(wrapper.findAll('.status-pill').map((pill) => pill.text())).toEqual([
      'Подключён',
      'Подключён',
    ]);
    wrapper.unmount();
  });

  it('does not offer disconnect for environment-managed channels', async () => {
    vi.stubGlobal('fetch', authenticatedFetch(environmentStatus));
    const wrapper = mount(SetupPage);
    await flushPromises();
    for (const toggle of wrapper.findAll('.setup-toggle')) {
      await toggle.trigger('click');
    }

    expect(wrapper.text().match(/Управляется на сервере\./g)).toHaveLength(2);
    expect(wrapper.text()).not.toContain('Отключить Telegram');
    expect(wrapper.text()).not.toContain('Отключить VK');
    wrapper.unmount();
  });
});

const localStatus = {
  connected: true,
  locked: true,
  source: 'local' as const,
  vk: { connected: true, locked: true, source: 'local' as const },
};
const environmentStatus = {
  connected: true,
  locked: true,
  source: 'environment' as const,
  vk: { connected: true, locked: true, source: 'environment' as const },
};

function authenticatedFetch(status: typeof environmentStatus) {
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
