import type { TelegramRuntimeConfig } from '@/config/runtime-config.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import { TelegramApiClient } from '@/infrastructure/telegram/telegram-api-client.js';
import { TelegramClientChannel } from '@/infrastructure/telegram/telegram-client-channel.js';
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
    const handoffService = new HandoffService({
      clientChannels: [new TelegramClientChannel(gateway)],
      operatorInbox: new TelegramTopicsInbox(gateway, config.operatorChatId),
      repository: this.repository,
    });
    const poller = new TelegramPoller(
      gateway,
      new TelegramUpdateRouter(handoffService, config.operatorChatId),
      config.pollTimeoutSeconds,
    );
    const abortController = new AbortController();
    this.abortController = abortController;
    this.pollerPromise = poller.run(abortController.signal);
    void this.pollerPromise.catch((error: unknown) => {
      if (!abortController.signal.aborted) {
        this.logger.error(error, 'Telegram poller stopped unexpectedly');
      }
    });
  }

  public async stop(): Promise<void> {
    const abortController = this.abortController;
    const pollerPromise = this.pollerPromise;
    this.abortController = undefined;
    this.pollerPromise = undefined;
    abortController?.abort();
    await pollerPromise?.catch((error: unknown) => {
      if (!isAbortError(error)) {
        this.logger.error(error, 'Telegram poller stopped during shutdown');
      }
    });
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
