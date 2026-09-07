// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';
import { contentResponse, findButton } from './content-management-test-helpers';

describe('ContentManagementPage load recovery', () => {
  it('does not expose an empty editor when initial content loading fails', async () => {
    let contentUnavailable = true;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/history')) {
          return Promise.resolve(response({ history: [] }));
        }
        if (contentUnavailable) {
          return Promise.resolve(
            response({ message: 'Не удалось загрузить информацию.' }, 500),
          );
        }
        return Promise.resolve(contentResponse('Расписание загружено'));
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    expect(wrapper.find('#schedule').exists()).toBe(false);
    expect(wrapper.text()).toContain('Редактор не открыт');

    contentUnavailable = false;
    await findButton(wrapper.findAll('button'), 'Повторить').trigger('click');
    await flushPromises();

    expect(wrapper.get<HTMLTextAreaElement>('#schedule').element.value).toBe(
      'Расписание загружено',
    );
  });
});
