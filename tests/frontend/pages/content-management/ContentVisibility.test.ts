// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

const initialVersion = 'a'.repeat(64);

describe('content visibility', () => {
  it('hides a filled standard section from the client preview', async () => {
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
        return Promise.resolve(
          response({
            content: { schedule: 'Понедельник, 19:00' },
            version: initialVersion,
          }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();

    await wrapper
      .get<HTMLInputElement>('.visibility-control input')
      .setValue(false);
    const previewButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Предпросмотр');
    if (!previewButton) {
      throw new Error('Expected the preview button');
    }
    await previewButton.trigger('click');

    expect(wrapper.text()).not.toContain('Понедельник, 19:00');
    expect(wrapper.text()).toContain('Заполните разделы');
    expect(wrapper.text()).toContain('Есть несохранённые изменения');
  });
});
