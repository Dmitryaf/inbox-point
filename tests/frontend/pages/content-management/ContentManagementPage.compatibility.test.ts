// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

describe('ContentManagementPage compatibility', () => {
  it('asks for a reload when a cached page reaches an older server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        return Promise.resolve(
          response({
            content: { schedule: 'Старое расписание' },
            version: 'a'.repeat(64),
          }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Сервер и страница используют разные версии',
    );
    expect(wrapper.text()).toContain('Обновите страницу');
  });
});
