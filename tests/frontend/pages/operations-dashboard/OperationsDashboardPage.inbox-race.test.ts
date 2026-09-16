// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { attentionOperationsStatus } from './operations-status-fixture';

describe('OperationsDashboardPage operator inbox ownership', () => {
  it('refreshes the inbox when recovery wins a concurrent web reply', async () => {
    let movedToTelegram = false;
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
            response({ requests: movedToTelegram ? [] : [request] }),
          );
        }
        if (url.endsWith('/inbox/requests/request-1/messages')) {
          return Promise.resolve(response({ messages: [incoming] }));
        }
        if (url.endsWith('/replies')) {
          movedToTelegram = true;
          return Promise.resolve(response({ message: conflictMessage }, 409));
        }
        return Promise.resolve(response(attentionOperationsStatus()));
      }),
    );

    const wrapper = mount(OperationsDashboardPage, {
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises();

    await wrapper.find('#operator-reply').setValue('Мы поможем');
    await wrapper.find('.operator-reply-form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain(conflictMessage);
    expect(wrapper.text()).not.toContain('Тестовый клиент');
    wrapper.unmount();
  });
});

const conflictMessage = 'Обращение уже перенесено в Telegram. Список обновлён.';
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
