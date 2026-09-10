// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

const initialVersion = 'a'.repeat(64);

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
        return Promise.resolve(
          response({ content: {}, version: initialVersion }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();

    await wrapper.get('#editor-section').setValue('faq');
    expect(wrapper.text()).toContain(
      'Добавьте хотя бы один вопрос и ответ, чтобы показать этот раздел.',
    );
    await wrapper.get('#workspace-view').setValue('preview');
    expect(wrapper.text()).toContain('здесь появится будущий ответ');
    await wrapper.get('#workspace-view').setValue('history');
    expect(wrapper.text()).toContain('Изменений пока нет');
  });

  it('shows the validation error next to the field and focuses it', async () => {
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
          response({ content: {}, version: initialVersion }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('#editor-section').setValue('faq');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Добавить вопрос')
      ?.trigger('click');
    await wrapper.get('#editor-section').setValue('core');

    const correctionButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Исправить поля');
    expect(correctionButton).toBeDefined();
    await correctionButton?.trigger('click');

    expect(wrapper.get('#editor-section').element).toHaveProperty(
      'value',
      'faq',
    );
    expect(wrapper.get('#faq-question-0-error').text()).toBe(
      'Заполните вопрос и ответ в этой карточке.',
    );
    expect(document.activeElement).toBe(wrapper.get('#faq-question-0').element);
    wrapper.unmount();
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
        return Promise.resolve(
          response({
            content: { schedule: 'Старое расписание' },
            version: initialVersion,
          }),
        );
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
    window.history.replaceState(null, '', '/manage');
    window.sessionStorage.clear();
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

    expect(window.location.pathname).toBe('/login');
    expect(wrapper.text()).not.toContain('Содержание');
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);

    wrapper.unmount();
    window.history.replaceState(null, '', '/');
    window.sessionStorage.clear();
  });
});
