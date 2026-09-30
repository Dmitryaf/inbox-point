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

describe('SetupPage errors', () => {
  it('ends loading after a failed status request and allows retry', async () => {
    let available = false;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        Promise.resolve(
          requestUrl(input).endsWith('/admin/session')
            ? response({ authenticated: true })
            : available
              ? response(disconnectedStatus)
              : response({ message: 'Не удалось проверить подключения.' }, 503),
        ),
      ),
    );
    const wrapper = mount(SetupPage);
    await flushPromises();
    expect(wrapper.text()).not.toContain('Проверяем подключения');
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Не удалось проверить',
    );
    available = true;
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Повторить проверку подключений')!
      .trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Подключить Telegram');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
  it('announces a prepared setup error as an alert', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/admin/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/setup/status')) {
          return Promise.resolve(response(disconnectedStatus));
        }
        if (url.endsWith('/telegram/discover')) {
          return Promise.resolve(
            response({ message: 'Проверьте токен и группу.' }, 400),
          );
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }),
    );

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

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Проверьте токен и группу.',
    );

    wrapper.unmount();
  });
});
