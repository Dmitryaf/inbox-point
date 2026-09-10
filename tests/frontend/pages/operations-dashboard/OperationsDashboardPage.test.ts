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
        if (url.endsWith('/service-control/delivery/pause')) {
          return Promise.resolve(
            response({
              channels: {
                telegram: { mode: 'paused' },
                vk: { mode: 'active' },
              },
              delivery: { mode: 'paused' },
            }),
          );
        }
        return Promise.resolve(response(attentionOperationsStatus()));
      }),
    );

    const wrapper = mount(OperationsDashboardPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Нужно проверить');
    expect(wrapper.text()).toContain(
      'Выше показано, что не работает и что нужно сделать.',
    );
    expect(wrapper.text()).toContain('Требует внимания');
    const attentionPanel = wrapper.get('.attention-panel').element;
    const summaryCard = wrapper.get('.service-summary').element;
    expect(
      attentionPanel.compareDocumentPosition(summaryCard) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const statusCards = wrapper.findAll('.status-card');
    expect(statusCards[0]?.text()).toContain('Telegram');
    expect(statusCards[0]?.text()).toContain('Работает');
    expect(statusCards[0]?.text()).toContain(
      'Новые обращения приостановлены вручную',
    );
    expect(statusCards[0]?.text()).toContain('Последняя успешная проверка');
    expect(statusCards[1]?.text()).toContain('VK');
    expect(statusCards[1]?.text()).toContain('Ошибка связи');
    expect(statusCards[1]?.text()).toContain('Последняя ошибка связи');
    expect(statusCards[2]?.text()).toContain('Ожидают отправки3');
    expect(statusCards[2]?.text()).toContain('Не доставлены2');
    expect(statusCards[2]?.text()).toContain('Система отправкиЗапущена');
    expect(wrapper.get('.attention-panel').text()).toContain(
      'ID обращенияrequest-9',
    );
    expect(wrapper.get('.attention-panel').text()).toContain(
      'ID темы в Telegramtopic-42',
    );
    expect(wrapper.get('.attention-panel').text()).toContain(
      'ID сообщенияoperator-message-17',
    );
    expect(
      wrapper.get('.attention-panel .technical-details').element,
    ).toHaveProperty('open', false);

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить отправку')
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
    expect(wrapper.text()).toContain('Повторная отправка началась.');

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Остановить доставку')
      ?.trigger('click');
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(
      '/api/ops/service-control/delivery/pause',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(wrapper.text()).toContain(
      'Отправка ответов остановлена. Сохранённые ответы не потеряны.',
    );

    wrapper.unmount();
  });
});
