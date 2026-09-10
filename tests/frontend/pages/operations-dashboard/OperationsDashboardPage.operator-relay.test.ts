// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { attentionOperationsStatus } from './operations-status-fixture';

describe('OperationsDashboardPage operator relay resolution', () => {
  it('offers manual verification without an automatic Telegram retry', async () => {
    const status = attentionOperationsStatus();
    status.deliveries.incidents = [];
    status.operatorRelays = {
      incidents: [
        {
          action: 'relay_message',
          channel: 'Telegram',
          clientMessageId: 'client-message-1',
          confirmable: true,
          createdAt: '2026-09-06T12:00:00.000Z',
          id: 'operator-relay-1',
          initial: true,
          operatorTopicId: '900',
          reason: 'Telegram мог принять сообщение клиента.',
          requestId: 'request-1',
          sequence: 1,
        },
      ],
      state: 'uncertain',
      uncertain: 1,
    };
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
      if (url.endsWith('/operator-actions/operator-relay-1/resolve')) {
        return Promise.resolve(response({ resolved: true }));
      }
      return Promise.resolve(response(status));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(OperationsDashboardPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Новые обращения');
    expect(wrapper.text()).not.toContain('Повторить отправку');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Сообщение есть в Telegram')
      ?.trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ops/operator-actions/operator-relay-1/resolve',
      expect.objectContaining({
        body: JSON.stringify({ resolution: 'received' }),
        method: 'POST',
      }),
    );
    expect(wrapper.text()).toContain(
      'Подтверждено: сообщение есть в Telegram.',
    );
    wrapper.unmount();
  });
});
