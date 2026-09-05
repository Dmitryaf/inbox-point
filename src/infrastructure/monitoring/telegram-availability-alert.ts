import type { AvailabilityAlert } from '@/modules/operations-monitoring/application/availability-monitor.js';

export class TelegramAvailabilityAlert implements AvailabilityAlert {
  public constructor(
    private readonly botToken: string,
    private readonly chatId: string,
    private readonly timeoutMs: number,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  public async send(message: string): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchImplementation(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          body: JSON.stringify({ chat_id: this.chatId, text: message }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
    } catch {
      throw new Error('Telegram alert request failed');
    }
    if (!response.ok) {
      throw new Error(`Telegram alert returned HTTP ${response.status}`);
    }
  }
}
