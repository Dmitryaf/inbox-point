import type { TelegramRuntimeConfig } from '@/config/runtime-config.js';
import {
  ClientInformationCatalog,
  type ClientInformationResolver,
} from '@/core/application/client-information.js';
import {
  silentChannelActivityReporter,
  type ChannelActivityReporter,
} from '@/core/contracts/channel-activity-reporter.js';
import type { ClientChannel } from '@/core/contracts/client-channel.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import {
  acceptingClientIntakePolicy,
  type ClientIntakePolicy,
} from '@/core/contracts/client-intake-policy.js';
import type { OperatorInbox } from '@/core/contracts/operator-inbox.js';
import { TelegramApiClient } from '@/infrastructure/telegram/telegram-api-client.js';
import { TelegramClientChannel } from '@/infrastructure/telegram/telegram-client-channel.js';
import { TelegramClientMenu } from '@/infrastructure/telegram/telegram-client-menu.js';
import { TelegramPoller } from '@/infrastructure/telegram/telegram-poller.js';
import { TelegramTopicsInbox } from '@/infrastructure/telegram/telegram-topics-inbox.js';
import {
  type TelegramUpdateHandler,
  TelegramUpdateRouter,
} from '@/infrastructure/telegram/telegram-update-router.js';

export interface TelegramRuntimeLogger {
  error(error: unknown, message: string): void;
}

export interface TelegramRuntimeControl {
  readonly running: boolean;
  start(config: TelegramRuntimeConfig): Promise<void>;
  stop(): Promise<void>;
}

export interface TelegramHandoffHost extends TelegramUpdateHandler {
  registerClientChannel(channel: ClientChannel): () => void;
  registerOperatorInbox(inbox: OperatorInbox): () => void;
}

export class TelegramRuntime implements TelegramRuntimeControl {
  private abortController: AbortController | undefined;
  private pollerPromise: Promise<void> | undefined;
  private unregisterClientChannel: (() => void) | undefined;
  private unregisterOperatorInbox: (() => void) | undefined;

  public constructor(
    private readonly handoffHost: TelegramHandoffHost,
    private readonly repository: SupportRepository,
    private readonly logger: TelegramRuntimeLogger,
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
    private readonly activity: ChannelActivityReporter = silentChannelActivityReporter,
    private readonly intakePolicy: ClientIntakePolicy = acceptingClientIntakePolicy,
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
    const operatorInbox = new TelegramTopicsInbox(
      gateway,
      config.operatorChatId,
    );
    const poller = new TelegramPoller(
      gateway,
      new TelegramUpdateRouter(
        this.handoffHost,
        config.operatorChatId,
        new TelegramClientMenu(
          gateway,
          this.repository,
          config.operatorChatId,
          this.information,
          this.intakePolicy,
        ),
        gateway,
      ),
      config.pollTimeoutSeconds,
      {
        onError: (error) => {
          this.activity.recordPollFailed('telegram', new Date());
          this.logger.error(error, 'Telegram update failed; retrying');
        },
        onSuccess: () => {
          this.activity.recordPollSucceeded('telegram', new Date());
        },
      },
    );
    const abortController = new AbortController();
    const unregisterClientChannel =
      this.handoffHost.registerClientChannel(clientChannel);
    const unregisterOperatorInbox =
      this.handoffHost.registerOperatorInbox(operatorInbox);
    this.abortController = abortController;
    this.unregisterClientChannel = unregisterClientChannel;
    this.unregisterOperatorInbox = unregisterOperatorInbox;
    this.activity.recordPollerStarted('telegram', new Date());
    this.pollerPromise = poller.run(abortController.signal).finally(() => {
      this.activity.recordPollerStopped('telegram', new Date());
    });
    void this.pollerPromise.catch((error: unknown) => {
      if (!abortController.signal.aborted) {
        this.activity.recordPollFailed('telegram', new Date());
        this.logger.error(error, 'Telegram poller stopped unexpectedly');
      }
    });
  }

  public async stop(): Promise<void> {
    const abortController = this.abortController;
    const pollerPromise = this.pollerPromise;
    const unregisterClientChannel = this.unregisterClientChannel;
    const unregisterOperatorInbox = this.unregisterOperatorInbox;
    this.abortController = undefined;
    this.pollerPromise = undefined;
    this.unregisterClientChannel = undefined;
    this.unregisterOperatorInbox = undefined;
    abortController?.abort();
    unregisterOperatorInbox?.();
    unregisterClientChannel?.();
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
