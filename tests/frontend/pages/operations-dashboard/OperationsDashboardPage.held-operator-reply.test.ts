// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { attentionOperationsStatus } from './operations-status-fixture';

describe('OperationsDashboardPage held operator reply', () => {
  it('explains the saved reply and offers a safe topic retry', async () => {
    const status = attentionOperationsStatus();
    status.deliveries.incidents = [];
    status.operatorRelays = {
      incidents: [
        {
          action: 'reopen_request',
          channel: 'Telegram',
          clientMessageId: 'update-held',
          confirmable: true,
          createdAt: '2026-09-16T12:00:00.000Z',
          heldReplyCount: 1,
          id: 'operator-reopen:request-1:update-held',
          initial: false,
          operatorTopicId: '900',
          reason:
            'Открыть Telegram-тему не удалось. Ответ сохранён, повторно отправлять его не нужно. Можно повторить открытие или продолжить обращение здесь.',
          requestId: 'request-1',
          sequence: 0,
          status: 'failed',
        },
      ],
      state: 'uncertain',
      uncertain: 0,
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
      if (
        url.endsWith(
          '/operator-actions/operator-reopen%3Arequest-1%3Aupdate-held/resolve',
        )
      ) {
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

    expect(wrapper.text()).toContain('Ответ сохранён');
    expect(wrapper.text()).toContain('повторно отправлять его не нужно');
    expect(wrapper.text()).toContain('продолжить обращение здесь');
    expect(wrapper.text()).toContain('Открыть обращение здесь');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить открытие темы')
      ?.trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ops/operator-actions/operator-reopen%3Arequest-1%3Aupdate-held/resolve',
      expect.objectContaining({
        body: JSON.stringify({ resolution: 'retry' }),
        method: 'POST',
      }),
    );
    expect(wrapper.text()).toContain(
      'Сохранённый ответ не нужно отправлять ещё раз.',
    );
    wrapper.unmount();
  });
});
