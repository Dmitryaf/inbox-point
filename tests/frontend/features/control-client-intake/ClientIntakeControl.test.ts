// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl.vue';
import { requestUrl, response } from '@test/frontend/support/fake-response';

describe('ClientIntakeControl', () => {
  it('can pause Telegram without asking for a VK fallback', async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        const url = requestUrl(input);
        if (url.endsWith('/service-control') && !options?.method) {
          return Promise.resolve(response(activeState()));
        }
        if (url.endsWith('/telegram/pause')) {
          return Promise.resolve(
            response({
              channels: {
                telegram: { mode: 'paused' },
                vk: { mode: 'active' },
              },
            }),
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(ClientIntakeControl);
    await flushPromises();
    const pauseButtons = wrapper
      .findAll('button')
      .filter((button) => button.text() === 'Приостановить');

    expect(pauseButtons).toHaveLength(2);
    expect(wrapper.text()).toContain(
      'Клиенты могут начать новый разговор через бота.',
    );
    expect(wrapper.text()).toContain(
      'Новые сообщения передаются преподавателю.',
    );
    await pauseButtons[0]?.trigger('click');
    await flushPromises();

    expect(confirmMock).toHaveBeenCalledWith(
      'Приостановить новые обращения в Telegram? Бот предложит клиентам использовать контакт из описания.',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/manage/service-control/telegram/pause',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(wrapper.text()).toContain('На паузе');
    expect(wrapper.text()).toContain(
      'Новые обращения из Telegram приостановлены',
    );
    expect(wrapper.text()).toContain(
      'Бот не принимает новые обращения и предлагает посмотреть контакт в описании.',
    );
    expect(wrapper.findAll('input')).toHaveLength(0);
  });

  it('uses owner operations endpoints on the monitoring page', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response(activeState())));
    vi.stubGlobal('fetch', fetchMock);

    mount(ClientIntakeControl, { props: { scope: 'ops' } });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ops/service-control',
      expect.any(Object),
    );
  });

  it('lets the owner retry after the initial state request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ message: 'Не удалось прочитать состояние.' }, 500),
      )
      .mockResolvedValueOnce(response(activeState()));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ClientIntakeControl, { props: { scope: 'ops' } });
    await flushPromises();

    expect(wrapper.text()).toContain('Не удалось проверить');
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить проверку');
    expect(retry).toBeDefined();

    await retry?.trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('Приём включён');
  });
});

function activeState() {
  return {
    channels: {
      telegram: { mode: 'active' },
      vk: { mode: 'active' },
    },
  };
}
