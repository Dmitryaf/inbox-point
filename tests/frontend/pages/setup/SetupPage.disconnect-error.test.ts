// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import SetupPage from '@frontend/pages/setup/ui/SetupPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

describe('SetupPage disconnect error', () => {
  it('keeps the connected state and shows the API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/admin/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/setup/status')) {
          return Promise.resolve(response(localStatus));
        }
        if (url.endsWith('/setup/vk') && options?.method === 'DELETE') {
          return Promise.resolve(
            response({ message: 'Не удалось отключить VK.' }, 500),
          );
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const wrapper = mount(SetupPage);
    await flushPromises();
    for (const toggle of wrapper.findAll('.setup-toggle')) {
      await toggle.trigger('click');
    }

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Отключить VK')
      ?.trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Не удалось отключить VK.',
    );
    expect(wrapper.findAll('.status-pill').map((pill) => pill.text())).toEqual([
      'Подключён',
      'Подключён',
    ]);
    expect(wrapper.text()).toContain('Отключить VK');
    wrapper.unmount();
  });
});

const localStatus = {
  connected: true,
  locked: true,
  source: 'local' as const,
  vk: { connected: true, locked: true, source: 'local' as const },
};
