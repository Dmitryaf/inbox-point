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
    await refresh(wrapper.vm);
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
      'Приостановить новые обращения в Telegram? Бот сообщит о паузе и предложит связаться по контакту из описания.',
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
      'Бот не передаёт новые обращения оператору',
    );
    expect(wrapper.findAll('input')).toHaveLength(0);
  });

  it('uses owner operations endpoints on the monitoring page', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(response(activeState())));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ClientIntakeControl);
    await refresh(wrapper.vm);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ops/service-control',
      expect.any(Object),
    );
  });

  it('reports an initial state failure to the dashboard', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ message: 'Не удалось прочитать состояние.' }, 500),
      );
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ClientIntakeControl);

    await expect(refresh(wrapper.vm)).resolves.toBe(
      'Не удалось прочитать состояние.',
    );
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});

function refresh(component: unknown): Promise<string> {
  return (component as { refresh(): Promise<string> }).refresh();
}

function activeState() {
  return {
    channels: {
      telegram: { mode: 'active' },
      vk: { mode: 'active' },
    },
  };
}
