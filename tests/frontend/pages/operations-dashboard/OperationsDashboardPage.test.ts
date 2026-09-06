// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { attentionOperationsStatus } from './operations-status-fixture';

describe('OperationsDashboardPage', () => {
  it('shows actionable channel and delivery state for the owner', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
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
        return Promise.resolve(response(attentionOperationsStatus()));
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
    expect(statusCards[2]?.text()).toContain('Обращениеrequest-9');
    expect(statusCards[2]?.text()).toContain('Тема преподавателяtopic-42');
    expect(statusCards[2]?.text()).toContain(
      'Сообщение преподавателяoperator-message-17',
    );

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить доставку')
      ?.trigger('click');
    await flushPromises();

    expect(confirmMock).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      '/api/ops/deliveries/delivery-1/retry',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) =>
          requestUrl(input).endsWith('/service-control'),
        ).length,
    ).toBeGreaterThan(1);
    expect(wrapper.text()).toContain(
      'Ответ поставлен в очередь повторной доставки.',
    );

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
