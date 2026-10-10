// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { openGroup, groupContent } from './content-management-test-helpers';
import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

const initialVersion = 'a'.repeat(64);
const savedVersion = 'b'.repeat(64);

describe('ContentManagementPage channel button notice', () => {
  it('explains when clients receive updated channel buttons', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/history')) {
          return Promise.resolve(response({ history: [] }));
        }
        if (options?.method === 'POST') {
          return Promise.resolve(
            response({
              content: {
                ...groupContent('Новое расписание', 'Вторник, 20:00'),
              },
              version: savedVersion,
            }),
          );
        }
        return Promise.resolve(
          response({
            content: {
              ...groupContent('Старое расписание', 'Понедельник, 19:00'),
            },
            version: initialVersion,
          }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    await openGroup(wrapper);
    await wrapper.get('#group-name-group').setValue('Новое расписание');
    const saveButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Сохранить');
    if (!saveButton) {
      throw new Error('Expected a save button');
    }
    await saveButton.trigger('click');
    await flushPromises();
    await openGroup(wrapper);

    expect(wrapper.get('[role="status"]').text()).toContain(
      'Открытые у клиентов кнопки обновятся со следующим ответом бота',
    );
    expect(wrapper.get('[role="status"]').text()).toContain(
      'кнопку из недавней версии меню',
    );
    expect(wrapper.get('[role="status"]').text()).toContain(
      'без создания обращения',
    );
  });
});
