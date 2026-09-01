import type { TelegramGateway } from './telegram-api-client.js';
import type { TelegramUpdate } from './telegram-types.js';

export interface TelegramUpdateProcessor {
  route(update: TelegramUpdate): Promise<void>;
}

export class TelegramPoller {
  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly router: TelegramUpdateProcessor,
    private readonly timeoutSeconds: number,
    private readonly onError: (error: unknown) => void = () => undefined,
    private readonly retryDelay: (
      signal: AbortSignal,
    ) => Promise<void> = waitBeforeRetry,
  ) {}

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

async function waitBeforeRetry(signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, 1_000);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
