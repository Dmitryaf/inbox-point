// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { attentionOperationsStatus } from './operations-status-fixture';

describe('OperationsDashboardPage refresh', () => {
  it('shows one refresh error and does not present stale status as healthy', async () => {
    let online = true;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (!online) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        if (url.endsWith('/service-control')) {
          return Promise.resolve(
            response({
              channels: {
                telegram: { mode: 'active' },
                vk: { mode: 'active' },
              },
            }),
          );
        }
        if (url.endsWith('/inbox/requests')) {
          return Promise.resolve(response({ requests: [] }));
        }
        return Promise.resolve(
          response({ ...attentionOperationsStatus(), state: 'healthy' }),
        );
      }),
    );

    const wrapper = mount(OperationsDashboardPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Всё работает');

    online = false;
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Обновить')
      ?.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.ops-refresh-error')).toHaveLength(1);
    expect(
      wrapper.text().match(/Не удалось выполнить действие\./g),
    ).toHaveLength(1);
    expect(wrapper.text()).toContain('Состояние неизвестно');
    expect(wrapper.text()).toContain('Показаны последние данные от');
    expect(wrapper.text()).not.toContain('Всё работает');

    online = true;
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить проверку')
      ?.trigger('click');
    await flushPromises();

    expect(wrapper.find('.ops-refresh-error').exists()).toBe(false);
    expect(wrapper.text()).toContain('Всё работает');
    wrapper.unmount();
  });
});
