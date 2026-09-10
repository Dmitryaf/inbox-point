import { describe, expect, it, vi } from 'vitest';

import { WebhookAvailabilityAlert } from '@/infrastructure/monitoring/webhook-availability-alert.js';

describe('WebhookAvailabilityAlert', () => {
  it('sends a bearer-authenticated alert without Telegram', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    const alert = new WebhookAvailabilityAlert(
      new URL('https://alerts.example.test/hook'),
      5_000,
      'instance-a',
      'synthetic-token',
      fetchMock,
    );

    await alert.send('Service is not ready');

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://alerts.example.test/hook'),
      expect.objectContaining({
        body: JSON.stringify({
          instanceId: 'instance-a',
          message: 'Service is not ready',
          service: 'inbox-point',
        }),
        headers: {
          authorization: 'Bearer synthetic-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      }),
    );
  });
});
