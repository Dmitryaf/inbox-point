import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { response } from '@test/frontend/support/fake-response';
import { renderApp } from '@test/react/support/render-app';
import { mockOperations } from '@test/react/support/mock-operations';

it.each(['retry', 'skip'] as const)(
  'resolves inbound %s with its source, encoded event and explicit skip confirmation',
  async (resolution) => {
    const api = mockOperations();
    api.state.status.inboundEvents = {
      state: 'quarantined',
      quarantined: 1,
      incidents: [
        {
          attempts: 5,
          channel: 'Telegram',
          eventId: 'event:1',
          source: 'telegram:synthetic',
          reason: 'Сбой обработки',
          receivedAt: '2026-09-06T12:00:00Z',
        },
      ],
    };
    api.overrides.set('/api/ops/inbound-events/event%3A1/resolve', () =>
      Promise.resolve(response({ resolved: true })),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp('/ops');
    const button = await screen.findByRole('button', {
      name: resolution === 'retry' ? 'Повторить обработку' : 'Не обрабатывать',
    });
    if (resolution === 'skip') {
      fireEvent.click(button);
      expect(api.commands).toHaveLength(0);
    }
    confirm.mockReturnValue(true);
    fireEvent.click(button);
    await waitFor(() =>
      expect(api.commands).toEqual([
        {
          url: '/api/ops/inbound-events/event%3A1/resolve',
          body: { resolution, source: 'telegram:synthetic' },
        },
      ]),
    );
  },
);
