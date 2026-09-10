// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { attentionOperationsStatus } from './operations-status-fixture';

describe('OperationsDashboardPage operator inbox', () => {
  it('supports the emergency operator conversation without Telegram', async () => {
    let closed = false;
    let replied = false;
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('crypto', { randomUUID: () => 'web-action-1' });
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
                telegram: { mode: 'active' },
                vk: { mode: 'active' },
              },
              delivery: { mode: 'active' },
            }),
          );
        }
        if (url.endsWith('/inbox/requests')) {
          return Promise.resolve(
            response({ requests: closed ? [] : [request] }),
          );
        }
        if (url.endsWith('/inbox/requests/request-1/messages')) {
          return Promise.resolve(
            response({ messages: replied ? [incoming, outgoing] : [incoming] }),
          );
        }
        if (url.endsWith('/replies')) {
          replied = true;
          return Promise.resolve(response({ queued: true }));
        }
        if (url.endsWith('/close')) {
          closed = true;
          return Promise.resolve(response({ closed: true }));
        }
        return Promise.resolve(response(attentionOperationsStatus()));
      }),
    );

    const wrapper = mount(OperationsDashboardPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Входящие обращения');
    expect(wrapper.text()).toContain('Тестовый клиент');
    expect(wrapper.text()).toContain('Нужна помощь');

    await wrapper.find('#operator-reply').setValue('Мы поможем');
    await wrapper.find('.operator-reply-form').trigger('submit');
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(
      '/api/ops/inbox/requests/request-1/replies',
      expect.objectContaining({
        body: JSON.stringify({
          idempotencyKey: 'web-action-1',
          text: 'Мы поможем',
        }),
        method: 'POST',
      }),
    );
    expect(wrapper.text()).toContain('Ответ сохранён для отправки');
    expect(wrapper.text()).toContain('Готовится к отправке');

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Закрыть обращение')
      ?.trigger('click');
    await flushPromises();

    expect(confirmMock).toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('Входящие обращения');
    wrapper.unmount();
  });
});

const request = {
  channel: 'vk',
  createdAt: '2026-09-06T12:00:00.000Z',
  displayName: 'Тестовый клиент',
  id: 'request-1',
  latestMessageAt: '2026-09-06T12:00:00.000Z',
  status: 'active',
};
const incoming = {
  createdAt: '2026-09-06T12:00:00.000Z',
  direction: 'client_to_operator',
  id: 'message-1',
  senderName: 'Тестовый клиент',
  text: 'Нужна помощь',
};
const outgoing = {
  createdAt: '2026-09-06T12:01:00.000Z',
  deliveryOutcomeUnknown: false,
  deliveryStatus: 'pending',
  direction: 'operator_to_client',
  id: 'message-2',
  text: 'Мы поможем',
};
