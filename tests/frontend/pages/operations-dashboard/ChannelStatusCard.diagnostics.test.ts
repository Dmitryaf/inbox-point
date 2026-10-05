// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import ChannelStatusCard from '@frontend/widgets/operations-overview/ui/ChannelStatusCard.vue';

it('shows failure and recovery details only inside the collapsed technical section', async () => {
  const channel = {
    configured: true,
    running: false,
    source: 'local' as const,
    state: 'poll_failed' as const,
    consecutiveFailures: 3,
    lastFailedPollAt: '2026-10-05T12:00:00Z',
    lastFailure: {
      stage: 'startup' as const,
      request: {
        channel: 'telegram' as const,
        kind: 'transport' as const,
        method: 'getMe',
        durationMs: 15000,
        operationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        transportCodes: ['UND_ERR_CONNECT_TIMEOUT'],
      },
    },
  };
  const wrapper = mount(ChannelStatusCard, {
    props: { channel, intake: { mode: 'active' }, name: 'Telegram' },
  });
  expect(wrapper.get('details').element).toHaveProperty('open', false);
  expect(wrapper.get('summary').text()).toBe('Технические данные');
  expect(wrapper.text()).toContain('Ошибка связи');
  expect(wrapper.get('details').text()).toContain('UND_ERR_CONNECT_TIMEOUT');
  expect(wrapper.get('details').text()).toContain('15000 мс');
  expect(wrapper.get('details').text()).toContain('При подключении');
  await wrapper.setProps({
    channel: {
      ...channel,
      running: true,
      state: 'running',
      consecutiveFailures: 0,
      lastRecoveredAt: '2026-10-05T12:03:00Z',
    },
  });
  expect(wrapper.text()).toContain('Работает');
  expect(wrapper.text()).toContain('Связь восстановлена');
  expect(wrapper.text()).not.toContain('Ошибок подряд');
});
