// @vitest-environment jsdom

import { flushPromises, mount } from '@test/frontend/support/react-test-utils';
import { describe, expect, it, vi } from 'vitest';

import SetupPage from '@frontend/pages/setup/ui/SetupPage';
import { requestUrl, response } from '@test/frontend/support/fake-response';

describe('SetupPage', () => {
  it('shows all local setup workflows in the shared React application', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/status')) {
          return Promise.resolve(
            response({
              connected: false,
              locked: false,
              source: 'none',
              vk: { connected: false, locked: false, source: 'none' },
            }),
          );
        }
        return Promise.resolve(
          response({ failures: [], summary: { failed: 0, pending: 0 } }),
        );
      }),
    );

    const wrapper = mount(SetupPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Подключение Telegram');
    expect(wrapper.text()).toContain('Подключение VK');
    expect(wrapper.text()).toContain('Настройте Long Poll API');
    expect(wrapper.text()).toContain(
      'Ключ даёт доступ к сообщениям сообщества',
    );
    expect(wrapper.text()).toContain('Доставка ответов');
    expect(wrapper.text()).toContain('Резервная копия');
    expect(wrapper.find('#telegram-token').exists()).toBe(true);
    expect(wrapper.find('#vk-token').exists()).toBe(false);

    wrapper.unmount();
  });

  it('discovers Telegram groups without exposing the token in the page', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.endsWith('/status')) {
        return Promise.resolve(
          response({
            connected: false,
            locked: false,
            source: 'none',
            vk: { connected: false, locked: false, source: 'none' },
          }),
        );
      }
      if (url.endsWith('/telegram/discover')) {
        return Promise.resolve(
          response({ chats: [{ id: -1001, isForum: true, title: 'Тест' }] }),
        );
      }
      return Promise.resolve(
        response({ failures: [], summary: { failed: 0, pending: 0 } }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(SetupPage);
    await flushPromises();
    await wrapper
      .get('#telegram-token')
      .setValue('123456789:synthetic-telegram-token');
    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Тест');
    expect(wrapper.text()).not.toContain('synthetic-telegram-token');

    wrapper.unmount();
  });

  it('does not offer an automatic retry for an uncertain delivery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/status')) {
          return Promise.resolve(
            response({
              connected: true,
              locked: true,
              source: 'environment',
              vk: { connected: false, locked: false, source: 'none' },
            }),
          );
        }
        return Promise.resolve(
          response({
            failures: [
              {
                attempts: 1,
                channel: 'Telegram',
                createdAt: '2026-09-05T10:00:00.000Z',
                id: 'delivery-1',
                reason: 'Проверьте диалог клиента вручную.',
                retryAllowed: false,
              },
            ],
            summary: { failed: 1, pending: 0, uncertain: 1 },
          }),
        );
      }),
    );

    const wrapper = mount(SetupPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Требуют ручной проверки: 1');
    expect(wrapper.text()).toContain('Проверить вручную');
    expect(wrapper.text()).not.toContain('Повторить');

    wrapper.unmount();
  });

  it('uses a single column when only one channel needs setup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/status')) {
          return Promise.resolve(
            response({
              connected: true,
              locked: true,
              source: 'local',
              vk: { connected: false, locked: false, source: 'none' },
            }),
          );
        }
        return Promise.resolve(
          response({ failures: [], summary: { failed: 0, pending: 0 } }),
        );
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
