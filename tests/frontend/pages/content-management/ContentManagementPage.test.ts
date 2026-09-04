// @vitest-environment jsdom

import {
  flushPromises,
  mount,
  type DOMWrapper,
} from '@test/frontend/support/react-test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ContentManagementPage from '@manage/pages/content-management/ui/ContentManagementPage';
import { requestUrl, response } from '@test/frontend/support/fake-response';

describe('ContentManagementPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });

  it('loads structured content and exposes an unsaved-change state', async () => {
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
            faq: [{ answer: 'Напишите нам.', question: 'Как записаться?' }],
            schedule: 'Понедельник, 19:00',
          }),
        );
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();

    expect(wrapper.get<HTMLTextAreaElement>('#schedule').element.value).toBe(
      'Понедельник, 19:00',
    );
    expect(wrapper.text()).not.toContain('Как записаться?');
    expect(wrapper.text()).toContain('Все изменения сохранены');

    await clickButton(
      wrapper.findAll<HTMLButtonElement>('button'),
      'Частые вопросы',
    );
    expect(wrapper.get<HTMLInputElement>('#faq-question-0').element.value).toBe(
      'Как записаться?',
    );
    expect(wrapper.find('#schedule').exists()).toBe(false);

    await clickButton(wrapper.findAll<HTMLButtonElement>('button'), 'Основное');
    await wrapper.get('#schedule').setValue('Вторник, 20:00');
    await clickButton(
      wrapper.findAll<HTMLButtonElement>('button'),
      'Предпросмотр',
    );

    expect(wrapper.text()).toContain('Вторник, 20:00');
    expect(wrapper.text()).toContain('Есть несохранённые изменения');
  });

  it('restores an earlier revision and reloads the editor', async () => {
    let schedule = 'Вторник, 20:00';
    const history = [
      {
        changedAt: '2026-09-02T12:00:00.000Z',
        revision: 2,
        sections: ['schedule'],
      },
      {
        changedAt: '2026-09-01T12:00:00.000Z',
        revision: 1,
        sections: ['schedule'],
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/session')) {
          return Promise.resolve(response({ authenticated: true }));
        }
        if (url.endsWith('/restore') && options?.method === 'POST') {
          schedule = 'Понедельник, 19:00';
          return Promise.resolve(response({ restored: true }));
        }
        if (url.endsWith('/history')) {
          return Promise.resolve(response({ history }));
        }
        return Promise.resolve(response({ schedule }));
      }),
    );

    const wrapper = mount(ContentManagementPage);
    await flushPromises();
    await clickButton(wrapper.findAll<HTMLButtonElement>('button'), 'История');
    const restoreButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Восстановить');
    if (!restoreButton) {
      throw new Error('Expected a restore button');
    }
    await restoreButton.trigger('click');
    const confirmButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Да, восстановить');
    if (!confirmButton) {
      throw new Error('Expected a restore confirmation');
    }
    await confirmButton.trigger('click');
    await flushPromises();
    await clickButton(
      wrapper.findAll<HTMLButtonElement>('button'),
      'Редактирование',
    );

    expect(wrapper.get<HTMLTextAreaElement>('#schedule').element.value).toBe(
      'Понедельник, 19:00',
    );
    expect(wrapper.text()).toContain('Предыдущая версия восстановлена');
  });
});

async function clickButton(
  buttons: DOMWrapper<HTMLButtonElement>[],
  label: string,
): Promise<void> {
  const button = buttons.find((candidate) => candidate.text() === label);
  if (!button) {
    throw new Error(`Expected the "${label}" button`);
  }
  await button.trigger('click');
}
