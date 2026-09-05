import type { AvailabilityChecker } from '@/modules/operations-monitoring/application/availability-monitor.js';

export class HttpAvailabilityChecker implements AvailabilityChecker {
  public constructor(
    private readonly url: URL,
    private readonly timeoutMs: number,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  public async check(): Promise<void> {
    const response = await this.fetchImplementation(this.url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Health endpoint returned HTTP ${response.status}`);
    }
  }
}
