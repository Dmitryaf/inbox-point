import type { AvailabilityAlert } from '@/modules/operations-monitoring/application/availability-monitor.js';

export class WebhookAvailabilityAlert implements AvailabilityAlert {
  public constructor(
    private readonly url: URL,
    private readonly timeoutMs: number,
    private readonly bearerToken?: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  public async send(message: string): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchImplementation(this.url, {
        body: JSON.stringify({ message, service: 'messenger-handoff' }),
        headers: {
          ...(this.bearerToken
            ? { authorization: `Bearer ${this.bearerToken}` }
            : {}),
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new Error('Alert webhook request failed');
    }
    if (!response.ok) {
      throw new Error(`Alert webhook returned HTTP ${response.status}`);
    }
  }
}
