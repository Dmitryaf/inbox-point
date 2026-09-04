import type { VkGateway, VkLongPollServer } from './vk-api-client.js';
import type { VkLongPollEvent } from './vk-types.js';

export interface VkEventHandler {
  route(event: VkLongPollEvent): Promise<void>;
}

export interface VkPollerOptions {
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
  waitSeconds?: number;
}

export class VkPoller {
  private readonly onError: (error: unknown) => void;
  private readonly onSuccess: () => void;
  private readonly waitSeconds: number;

  public constructor(
    private readonly gateway: VkGateway,
    private readonly groupId: number,
    private readonly router: VkEventHandler,
    options: VkPollerOptions = {},
  ) {
    this.onError = options.onError ?? (() => undefined);
    this.onSuccess = options.onSuccess ?? (() => undefined);
    this.waitSeconds = options.waitSeconds ?? 25;
  }

  public async run(signal: AbortSignal): Promise<void> {
    let server = await this.gateway.getLongPollServer(this.groupId);
    while (!signal.aborted) {
      try {
        const response = await this.gateway.poll(
          server,
          this.waitSeconds,
          signal,
        );
        if ('failed' in response) {
          server = await this.recoverServer(server, response);
          this.onSuccess();
          continue;
        }
        server = { ...server, ts: response.ts };
        for (const update of response.updates) {
          await this.router.route(update);
        }
        this.onSuccess();
      } catch (error: unknown) {
        if (signal.aborted || isAbortError(error)) {
          return;
        }
        this.onError(error);
        await wait(1_000, signal);
        server = await this.gateway.getLongPollServer(this.groupId);
      }
    }
  }

  private async recoverServer(
    server: VkLongPollServer,
    failure: { failed: number; ts?: string },
  ): Promise<VkLongPollServer> {
    if (failure.failed === 1 && failure.ts) {
      return { ...server, ts: failure.ts };
    }
    return this.gateway.getLongPollServer(this.groupId);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}
