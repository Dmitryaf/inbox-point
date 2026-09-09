// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { attentionOperationsStatus } from './operations-status-fixture';

describe('OperationsDashboardPage inbound event quarantine', () => {
  it('returns a quarantined VK event to the queue', async () => {
    const status = attentionOperationsStatus();
    status.inboundEvents = {
      incidents: [
        {
          attempts: 3,
          channel: 'VK',
          eventId: 'vk-event-1',
          reason: 'Stored VK event is invalid',
          receivedAt: '2026-09-06T12:00:00.000Z',
          source: 'vk:long-poll',
        },
      ],
      quarantined: 1,
      state: 'quarantined',
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
      if (url.endsWith('/inbound-events/vk-event-1/resolve')) {
        return Promise.resolve(response({ resolved: true }));
      }
      return Promise.resolve(response(status));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(OperationsDashboardPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Quarantine VK');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить')
      ?.trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ops/inbound-events/vk-event-1/resolve',
      expect.objectContaining({
        body: JSON.stringify({
          resolution: 'retry',
          source: 'vk:long-poll',
        }),
        method: 'POST',
      }),
    );
    expect(wrapper.text()).toContain('Событие возвращено в очередь.');
    wrapper.unmount();
  });
});
