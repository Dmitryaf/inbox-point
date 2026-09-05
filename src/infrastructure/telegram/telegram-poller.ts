import { waitForDelay } from '@/core/application/wait-for-delay.js';

import type { TelegramGateway } from './telegram-api-client.js';
import type { TelegramUpdate } from './telegram-types.js';

export interface TelegramUpdateProcessor {
  route(update: TelegramUpdate): Promise<void>;
}

export interface TelegramPollerOptions {
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
  retryDelay?: (signal: AbortSignal) => Promise<void>;
}

export class TelegramPoller {
  private readonly onError: (error: unknown) => void;
  private readonly onSuccess: () => void;
  private readonly retryDelay: (signal: AbortSignal) => Promise<void>;

  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly router: TelegramUpdateProcessor,
    private readonly timeoutSeconds: number,
    options: TelegramPollerOptions = {},
  ) {
    this.onError = options.onError ?? (() => undefined);
    this.onSuccess = options.onSuccess ?? (() => undefined);
    this.retryDelay = options.retryDelay ?? waitForDelay.bind(undefined, 1_000);
  }

  public async run(signal: AbortSignal): Promise<void> {
    let offset: number | undefined;

    while (!signal.aborted) {
      try {
        const updates = await this.gateway.getUpdates({
          ...(offset === undefined ? {} : { offset }),
          signal,
          timeoutSeconds: this.timeoutSeconds,
        });

        for (const update of updates) {
          await this.router.route(update);
          offset = update.update_id + 1;
        }
        if (!signal.aborted) {
          this.onSuccess();
        }
      } catch (error: unknown) {
        if (isAbortError(error) || signal.aborted) {
          return;
        }
        this.onError(error);
        try {
          await this.retryDelay(signal);
        } catch (delayError: unknown) {
          if (isAbortError(delayError) || signal.aborted) {
            return;
          }
          throw delayError;
        }
      }
    }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
