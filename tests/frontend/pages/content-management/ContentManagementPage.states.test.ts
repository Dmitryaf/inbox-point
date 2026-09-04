// @vitest-environment jsdom

import { flushPromises, mount } from '@test/frontend/support/react-test-utils';
import { describe, expect, it, vi } from 'vitest';

import ContentManagementPage from '@manage/pages/content-management/ui/ContentManagementPage';
import { requestUrl, response } from '@test/frontend/support/fake-response';

describe('ContentManagementPage states', () => {
  it('explains the empty content state', async () => {
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
        return Promise.resolve(response({}));
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();

    await wrapper.get('#editor-section').setValue('faq');
    expect(wrapper.text()).toContain('Вопросов пока нет');
    await wrapper.get('#workspace-view').setValue('preview');
    expect(wrapper.text()).toContain('здесь появится будущий ответ');
    await wrapper.get('#workspace-view').setValue('history');
    expect(wrapper.text()).toContain('Изменений пока нет');
  });

  it('keeps an unsaved draft visible after a failed save', async () => {
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
            response({ message: 'Не удалось сохранить информацию.' }, 500),
          );
        }
        return Promise.resolve(response({ schedule: 'Старое расписание' }));
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    await wrapper.get('#schedule').setValue('Новое расписание');
    const saveButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Сохранить');
    if (!saveButton) {
      throw new Error('Expected a save button');
    }
    await saveButton.trigger('click');
    await flushPromises();

    expect(wrapper.get<HTMLTextAreaElement>('#schedule').element.value).toBe(
      'Новое расписание',
    );
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'изменения остались на этой странице',
    );
  });

  it('returns to login when the management session expires', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        return Promise.resolve(
          response({ message: 'Войдите, чтобы изменить информацию.' }, 401),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Сессия завершилась. Войдите снова.');
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
  });
});
