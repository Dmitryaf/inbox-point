import type { TelegramRuntimeConfig } from '@/config/runtime-config.js';
import { DeliveryWorker } from '@/core/application/delivery-worker.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import { TelegramApiClient } from '@/infrastructure/telegram/telegram-api-client.js';
import { TelegramClientChannel } from '@/infrastructure/telegram/telegram-client-channel.js';
import { TelegramClientMenu } from '@/infrastructure/telegram/telegram-client-menu.js';
import { TelegramPoller } from '@/infrastructure/telegram/telegram-poller.js';
import { TelegramTopicsInbox } from '@/infrastructure/telegram/telegram-topics-inbox.js';
import { TelegramUpdateRouter } from '@/infrastructure/telegram/telegram-update-router.js';

export interface TelegramRuntimeLogger {
  error(error: unknown, message: string): void;
}

export interface TelegramRuntimeControl {
  readonly running: boolean;
  start(config: TelegramRuntimeConfig): Promise<void>;
  stop(): Promise<void>;
}

export class TelegramRuntime implements TelegramRuntimeControl {
  private abortController: AbortController | undefined;
  private deliveryPromise: Promise<void> | undefined;
  private pollerPromise: Promise<void> | undefined;

  public constructor(
    private readonly repository: SupportRepository,
    private readonly logger: TelegramRuntimeLogger,
  ) {}

  public get running(): boolean {
    return this.abortController !== undefined;
  }

  public async start(config: TelegramRuntimeConfig): Promise<void> {
    if (this.running) {
      throw new Error('Telegram is already connected');
    }

    const gateway = new TelegramApiClient(config.botToken);
    await gateway.verifySetup(config.operatorChatId);
    const clientChannel = new TelegramClientChannel(gateway);
    const handoffService = new HandoffService({
      operatorInbox: new TelegramTopicsInbox(gateway, config.operatorChatId),
      repository: this.repository,
    });
    const deliveryWorker = new DeliveryWorker({
      channels: [clientChannel],
      onError: (error, context) =>
        this.logger.error(
          error,
          context.final
            ? `Telegram delivery ${context.deliveryId} failed permanently after ${context.attempt} attempts`
            : `Telegram delivery ${context.deliveryId} failed on attempt ${context.attempt}; retrying`,
        ),
      repository: this.repository,
    });
    const poller = new TelegramPoller(
      gateway,
      new TelegramUpdateRouter(
        handoffService,
        config.operatorChatId,
        new TelegramClientMenu(gateway, this.repository, config.operatorChatId),
      ),
      config.pollTimeoutSeconds,
      (error) => this.logger.error(error, 'Telegram update failed; retrying'),
    );
    const abortController = new AbortController();
    this.abortController = abortController;
    this.deliveryPromise = deliveryWorker.run(abortController.signal);
    this.pollerPromise = poller.run(abortController.signal);
    void this.deliveryPromise.catch((error: unknown) => {
      if (!abortController.signal.aborted) {
        this.logger.error(
          error,
          'Telegram delivery worker stopped unexpectedly',
        );
      }
    });
    void this.pollerPromise.catch((error: unknown) => {
      if (!abortController.signal.aborted) {
        this.logger.error(error, 'Telegram poller stopped unexpectedly');
      }
    });
  }

  public async stop(): Promise<void> {
    const abortController = this.abortController;
    const deliveryPromise = this.deliveryPromise;
    const pollerPromise = this.pollerPromise;
    this.abortController = undefined;
    this.deliveryPromise = undefined;
    this.pollerPromise = undefined;
    abortController?.abort();
    await Promise.all([
      deliveryPromise?.catch((error: unknown) => {
        if (!isAbortError(error)) {
          this.logger.error(
            error,
            'Telegram delivery worker stopped during shutdown',
          );
        }
      }),
      pollerPromise?.catch((error: unknown) => {
        if (!isAbortError(error)) {
          this.logger.error(error, 'Telegram poller stopped during shutdown');
        }
      }),
    ]);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
