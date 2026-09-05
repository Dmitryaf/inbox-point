// @vitest-environment jsdom

import { flushPromises, mount } from '@test/frontend/support/react-test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage';
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
        if (url.endsWith('/service-control')) {
          return Promise.resolve(
            response({
              channels: {
                telegram: { mode: 'paused' },
                vk: { mode: 'active' },
              },
            }),
          );
        }
        return Promise.resolve(
          response({
            channels: {
              telegram: {
                configured: true,
                lastSuccessfulPollAt: '2026-09-04T12:00:30.000Z',
                running: true,
                source: 'environment',
                state: 'running',
              },
              vk: {
                configured: true,
                lastFailedPollAt: '2026-09-04T12:00:45.000Z',
                running: false,
                source: 'local',
                state: 'poll_failed',
              },
            },
            deliveries: {
              failed: 2,
              oldestPendingAgeSeconds: 90,
              oldestPendingAt: '2026-09-04T11:59:30.000Z',
              pending: 3,
              state: 'failed',
              uncertain: 0,
              worker: {
                lastCycleAt: '2026-09-04T12:00:59.000Z',
                running: true,
                state: 'running',
              },
            },
            intake: {
              telegram: { mode: 'paused' },
              vk: { mode: 'active' },
            },
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
    expect(statusCards[0]?.text()).toContain(
      'Новые обращения приостановлены вручную',
    );
    expect(statusCards[0]?.text()).toContain('Последняя успешная проверка');
    expect(statusCards[1]?.text()).toContain('VK');
    expect(statusCards[1]?.text()).toContain('Ошибка связи');
    expect(statusCards[1]?.text()).toContain('Последняя ошибка связи');
    expect(statusCards[2]?.text()).toContain('Ожидают отправки3');
    expect(statusCards[2]?.text()).toContain('Не доставлены2');
    expect(statusCards[2]?.text()).toContain('Обработчик очередиЗапущен');

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
    expect(wrapper.find('.auth-panel .auth-card').exists()).toBe(true);

    wrapper.unmount();
  });
});
