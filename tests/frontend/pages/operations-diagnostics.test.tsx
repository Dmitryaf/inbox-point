import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ChannelStatusCard } from '@frontend/widgets/operations-overview/ui/ChannelStatusCard';
import type { ChannelOperationsStatus } from '@frontend-common/entities/operations/model/types';

it('keeps API diagnostics in closed technical details and shows recovery instead of stale failure count', () => {
  const channel: ChannelOperationsStatus = {
    configured: true,
    running: false,
    source: 'local',
    state: 'poll_failed',
    consecutiveFailures: 3,
    lastFailedPollAt: '2026-10-05T12:00:00Z',
    lastFailure: {
      stage: 'startup',
      request: {
        channel: 'telegram',
        kind: 'transport',
        method: 'getMe',
        durationMs: 15000,
        operationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        transportCodes: ['UND_ERR_CONNECT_TIMEOUT'],
      },
    },
  };
  const { container, rerender } = render(
    <ChannelStatusCard
      channel={channel}
      intake={{ mode: 'active' }}
      name="Telegram"
    />,
  );
  expect(container.querySelector('details')?.open).toBe(false);
  expect(screen.getByText('Ошибка связи')).toBeDefined();
  expect(screen.getByText('UND_ERR_CONNECT_TIMEOUT')).toBeDefined();
  expect(screen.getByText('15000 мс')).toBeDefined();
  expect(screen.getByText('При подключении')).toBeDefined();
  rerender(
    <ChannelStatusCard
      channel={{
        ...channel,
        running: true,
        state: 'running',
        consecutiveFailures: 0,
        lastRecoveredAt: '2026-10-05T12:03:00Z',
      }}
      intake={{ mode: 'active' }}
      name="Telegram"
    />,
  );
  expect(screen.getByText('Работает')).toBeDefined();
  expect(screen.getByText('Связь восстановлена')).toBeDefined();
  expect(screen.queryByText('Ошибок подряд')).toBeNull();
});
