import type { VkGateway, VkLongPollServer } from './vk-api-client.js';
import type { VkLongPollEvent } from './vk-types.js';

export interface VkEventHandler {
  route(event: VkLongPollEvent): Promise<void>;
}

export class VkPoller {
  public constructor(
    private readonly gateway: VkGateway,
    private readonly groupId: number,
    private readonly router: VkEventHandler,
    private readonly waitSeconds = 25,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

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
          continue;
        }
        server = { ...server, ts: response.ts };
        for (const update of response.updates) {
          await this.router.route(update);
        }
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
