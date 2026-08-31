import type { TelegramGateway } from './telegram-api-client.js';
import type { TelegramUpdateRouter } from './telegram-update-router.js';

export class TelegramPoller {
  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly router: TelegramUpdateRouter,
    private readonly timeoutSeconds: number,
  ) {}

  public async run(signal: AbortSignal): Promise<void> {
    let offset: number | undefined;

    while (!signal.aborted) {
      const updates = await this.gateway.getUpdates({
        ...(offset === undefined ? {} : { offset }),
        signal,
        timeoutSeconds: this.timeoutSeconds,
      });

      for (const update of updates) {
        await this.router.route(update);
        offset = update.update_id + 1;
      }
    }
  }
}
