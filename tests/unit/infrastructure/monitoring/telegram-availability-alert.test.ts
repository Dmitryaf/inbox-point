import { describe, expect, it, vi } from 'vitest';

import { TelegramAvailabilityAlert } from '@/infrastructure/monitoring/telegram-availability-alert.js';

describe('TelegramAvailabilityAlert', () => {
  it('does not expose the bot token when the network request fails', async () => {
    const alert = new TelegramAvailabilityAlert(
      'synthetic-secret-token',
      '123',
      5_000,
      vi.fn<typeof fetch>(() =>
        Promise.reject(
          new Error(
            'request to https://api.telegram.org/botsynthetic-secret-token failed',
          ),
        ),
      ),
    );

    await expect(alert.send('Service unavailable')).rejects.toThrow(
      'Telegram alert request failed',
    );
    await expect(alert.send('Service unavailable')).rejects.not.toThrow(
      'synthetic-secret-token',
    );
  });
});
