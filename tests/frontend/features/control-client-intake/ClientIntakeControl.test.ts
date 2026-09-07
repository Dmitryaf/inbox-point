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
    expect(wrapper.text()).toContain('Новый вопрос можно задать через бота.');
    expect(wrapper.text()).toContain(
      'Новый вопрос можно задать через сообщество.',
    );
    await pauseButtons[0]?.trigger('click');
    await flushPromises();

    expect(confirmMock).toHaveBeenCalledWith(
      'Приостановить новые обращения в Telegram? В боте появится сообщение о временной паузе.',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ops/service-control/telegram/pause',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(wrapper.text()).toContain('На паузе');
    expect(wrapper.text()).toContain(
      'Новые обращения из Telegram приостановлены',
    );
    expect(wrapper.text()).toContain(
      'В канале появится сообщение, что новые обращения временно не принимаются.',
    );
    expect(wrapper.findAll('input')).toHaveLength(0);
  });

  it('uses owner operations endpoints on the monitoring page', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response(activeState())));
    vi.stubGlobal('fetch', fetchMock);

    mount(ClientIntakeControl);
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

    const wrapper = mount(ClientIntakeControl);
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
