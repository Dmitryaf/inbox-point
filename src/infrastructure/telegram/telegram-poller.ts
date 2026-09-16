import { waitForDelay } from '@/core/application/wait-for-delay.js';
import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import type { InboundEventStore } from '@/core/contracts/support-repository.js';
import type { QueuedInboundEvent } from '@/core/model/inbound-event.js';

import type { TelegramGateway } from './telegram-api-client.js';
import { telegramUpdateSchema, type TelegramUpdate } from './telegram-types.js';

const inboundEventSource = 'telegram:get-updates';

export interface TelegramUpdateProcessor {
  route(update: TelegramUpdate): Promise<void>;
}

export interface TelegramPollerOptions {
  clock?: () => Date;
  maxEventAttempts?: number;
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
  retryDelayMs?: number;
  retryDelay?: (signal: AbortSignal) => Promise<void>;
}

export class TelegramPoller {
  private readonly clock: () => Date;
  private readonly maxEventAttempts: number;
  private readonly onError: (error: unknown) => void;
  private readonly onSuccess: () => void;
  private readonly retryDelay: (signal: AbortSignal) => Promise<void>;
  private readonly retryDelayMs: number;

  public constructor(
    private readonly gateway: TelegramGateway,
    private readonly router: TelegramUpdateProcessor,
    private readonly timeoutSeconds: number,
    private readonly eventStore: InboundEventStore,
    options: TelegramPollerOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.maxEventAttempts = options.maxEventAttempts ?? 3;
    this.onError = options.onError ?? (() => undefined);
    this.onSuccess = options.onSuccess ?? (() => undefined);
    this.retryDelay = options.retryDelay ?? waitForDelay.bind(undefined, 1_000);
    this.retryDelayMs = options.retryDelayMs ?? 1_000;
  }

  public async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        const pendingEvent = this.eventStore.findPendingInboundEvents(
          inboundEventSource,
          1,
        )[0];
        if (pendingEvent) {
          await this.processPendingEvent(pendingEvent, signal);
          continue;
        }

        const offset = parseStoredOffset(
          this.eventStore.findInboundEventCursor(inboundEventSource),
        );
        const updates = await this.gateway.getUpdates({
          ...(offset === undefined ? {} : { offset }),
          signal,
          timeoutSeconds: this.timeoutSeconds,
        });
        if (updates.length > 0) {
          this.persistUpdates(updates, offset);
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

  private async processPendingEvent(
    event: QueuedInboundEvent,
    signal: AbortSignal,
  ): Promise<void> {
    if (event.nextAttemptAt && event.nextAttemptAt > this.clock()) {
      await this.retryDelay(signal);
      if (signal.aborted) {
        return;
      }
    }
    try {
      await this.router.route(parseStoredUpdate(event.payload));
      this.eventStore.completeInboundEvent(
        inboundEventSource,
        event.externalEventId,
      );
    } catch (error: unknown) {
      if (signal.aborted || isAbortError(error)) {
        throw error;
      }
      const nextAttemptAt = new Date(
        this.clock().getTime() + this.retryDelayMs,
      );
      this.eventStore.recordInboundEventFailure(
        inboundEventSource,
        event.externalEventId,
        safeErrorMessage(error),
        nextAttemptAt,
        error instanceof DeliveryOutcomeUnknownError
          ? 1
          : this.maxEventAttempts,
      );
      this.onError(error);
    }
  }

  private persistUpdates(
    updates: readonly TelegramUpdate[],
    currentOffset: number | undefined,
  ): void {
    const receivedAt = this.clock();
    const highestUpdateId = Math.max(
      ...updates.map((update) => update.update_id),
    );
    const nextOffset = Math.max(currentOffset ?? 0, highestUpdateId + 1);
    this.eventStore.enqueueInboundEventsAndAdvanceCursor(
      inboundEventSource,
      updates.map((update) => ({
        externalEventId: String(update.update_id),
        payload: JSON.stringify(update),
        receivedAt,
        source: inboundEventSource,
      })),
      String(nextOffset),
    );
  }
}

function parseStoredOffset(cursor: string | undefined): number | undefined {
  if (cursor === undefined) {
    return undefined;
  }
  const offset = Number(cursor);
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    String(offset) !== cursor
  ) {
    throw new Error('Stored Telegram update offset is invalid');
  }
  return offset;
}

function parseStoredUpdate(payload: string): TelegramUpdate {
  const parsedJson: unknown = JSON.parse(payload);
  const parsed = telegramUpdateSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error('Stored Telegram update is invalid');
  }
  return parsed.data;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : 'Unknown Telegram update processing error';
}
