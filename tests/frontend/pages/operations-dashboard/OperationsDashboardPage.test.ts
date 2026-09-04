// @vitest-environment jsdom

import { flushPromises, mount } from '@test/frontend/support/react-test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@ops/pages/operations-dashboard/ui/OperationsDashboardPage';
import { requestUrl, response } from '@test/frontend/support/fake-response';

describe('OperationsDashboardPage', () => {
  it('shows actionable channel and delivery state for the owner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        return Promise.resolve(
          response({
            channels: {
              telegram: {
                configured: true,
                running: true,
                source: 'environment',
              },
              vk: { configured: true, running: false, source: 'local' },
            },
            deliveries: { failed: 2, pending: 3 },
            observedAt: '2026-09-04T12:01:00.000Z',
            startedAt: '2026-09-04T12:00:00.000Z',
            state: 'attention',
            uptimeSeconds: 60,
          }),
        );
      }),
    );

    const wrapper = mount(OperationsDashboardPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Нужно проверить');
    const statusCards = wrapper.findAll('.status-card');
    expect(statusCards[0]?.text()).toContain('Telegram');
    expect(statusCards[0]?.text()).toContain('Запущен');
    expect(statusCards[1]?.text()).toContain('VK');
    expect(statusCards[1]?.text()).toContain('Остановлен');
    expect(statusCards[2]?.text()).toContain('Ожидают отправки3');
    expect(statusCards[2]?.text()).toContain('Не доставлены2');

    wrapper.unmount();
  });

  it('returns to login when the owner session expires', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        return Promise.resolve(
          response(
            { message: 'Войдите, чтобы увидеть состояние сервиса.' },
            401,
          ),
        );
      }),
    );

    const wrapper = mount(OperationsDashboardPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Сессия завершилась');
    expect(wrapper.text()).toContain('Вход владельца');

    wrapper.unmount();
  });
});
