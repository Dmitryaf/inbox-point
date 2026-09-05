import { createHash } from 'node:crypto';

import type { InboundEventStore } from '@/core/contracts/support-repository.js';

import type { VkGateway, VkLongPollServer } from './vk-api-client.js';
import { vkLongPollEventSchema, type VkLongPollEvent } from './vk-types.js';

const inboundEventSource = 'vk:long-poll';

export interface VkEventHandler {
  route(event: VkLongPollEvent): Promise<void>;
}

export interface VkPollerOptions {
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
  retryDelay?: (signal: AbortSignal) => Promise<void>;
  waitSeconds?: number;
}

export class VkPoller {
  private readonly onError: (error: unknown) => void;
  private readonly onSuccess: () => void;
  private readonly retryDelay: (signal: AbortSignal) => Promise<void>;
  private readonly waitSeconds: number;

  public constructor(
    private readonly gateway: VkGateway,
    private readonly groupId: number,
    private readonly router: VkEventHandler,
    private readonly eventStore: InboundEventStore,
    options: VkPollerOptions = {},
  ) {
    this.onError = options.onError ?? (() => undefined);
    this.onSuccess = options.onSuccess ?? (() => undefined);
    this.retryDelay = options.retryDelay ?? ((signal) => wait(1_000, signal));
    this.waitSeconds = options.waitSeconds ?? 25;
  }

  public async run(signal: AbortSignal): Promise<void> {
    let server: VkLongPollServer | undefined;

    while (!signal.aborted) {
      try {
        const pendingEvent = this.eventStore.findPendingInboundEvents(
          inboundEventSource,
          1,
        )[0];
        if (pendingEvent) {
          const update = parseStoredUpdate(pendingEvent.payload);
          await this.router.route(update);
          this.eventStore.completeInboundEvent(
            inboundEventSource,
            pendingEvent.externalEventId,
          );
          continue;
        }

        const currentServer =
          server ?? (await this.gateway.getLongPollServer(this.groupId));
        server = currentServer;

        const response = await this.gateway.poll(
          currentServer,
          this.waitSeconds,
          signal,
        );
        if ('failed' in response) {
          server = await this.recoverServer(currentServer, response);
          this.onSuccess();
          continue;
        }

        this.persistUpdates(response.updates);
        server = { ...currentServer, ts: response.ts };
        this.onSuccess();
      } catch (error: unknown) {
        if (signal.aborted || isAbortError(error)) {
          return;
        }
        this.onError(error);
        await this.retryDelay(signal);
      }
    }
  }

  private persistUpdates(updates: readonly VkLongPollEvent[]): void {
    const receivedAt = new Date();
    this.eventStore.enqueueInboundEvents(
      updates.map((update) => {
        const payload = JSON.stringify(update);
        return {
          externalEventId: createStoredEventId(update, payload),
          payload,
          receivedAt,
          source: inboundEventSource,
        };
      }),
    );
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

function createStoredEventId(event: VkLongPollEvent, payload: string): string {
  if (event.event_id) {
    return event.event_id;
  }
  return createHash('sha256').update(payload).digest('hex');
}

function parseStoredUpdate(payload: string): VkLongPollEvent {
  const parsedJson: unknown = JSON.parse(payload);
  const parsed = vkLongPollEventSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error('Stored VK event is invalid');
  }
  return parsed.data;
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
