// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { attentionOperationsStatus } from './operations-status-fixture';

describe('OperationsDashboardPage delivery resolution', () => {
  it('closes an unknown outcome only after the owner confirms receipt', async () => {
    const status = attentionOperationsStatus();
    status.deliveries.incidents = [
      {
        attempts: 1,
        channel: 'Telegram',
        createdAt: '2026-09-04T12:00:00.000Z',
        id: 'delivery-unknown',
        operatorMessageId: 'operator-message-18',
        operatorTopicId: 'topic-43',
        outcomeUnknown: true,
        reason: 'Канал мог принять ответ, но подтверждение не получено.',
        requestId: 'request-10',
        retryAllowed: false,
      },
    ];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.endsWith('/session')) {
        return Promise.resolve(response({ authenticated: true }));
      }
      if (url.endsWith('/service-control')) {
        return Promise.resolve(
          response({
            channels: {
              telegram: { mode: 'active' },
              vk: { mode: 'active' },
            },
            delivery: { mode: 'active' },
          }),
        );
      }
      if (url.endsWith('/deliveries/delivery-unknown/resolve')) {
        return Promise.resolve(response({ queued: false, resolved: true }));
      }
      return Promise.resolve(response(status));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(OperationsDashboardPage);
    await flushPromises();
    expect(wrapper.text()).not.toContain('Повторить доставку');

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Клиент получил')
      ?.trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ops/deliveries/delivery-unknown/resolve',
      expect.objectContaining({
        body: JSON.stringify({ resolution: 'received' }),
        method: 'POST',
      }),
    );
    expect(wrapper.text()).toContain(
      'Доставка отмечена как подтверждённая клиентом.',
    );
    wrapper.unmount();
  });
});
