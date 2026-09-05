import type { VkRuntimeConfig } from '@/config/runtime-config.js';
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
import type { SupportMessage } from '@/core/model/support-message.js';

import { VkApiClient } from './vk-api-client.js';
import { VkClientChannel } from './vk-client-channel.js';
import { VkClientMenu } from './vk-client-menu.js';
import { VkPoller } from './vk-poller.js';
import { VkUpdateRouter } from './vk-update-router.js';

export interface VkRuntimeLogger {
  error(error: unknown, message: string): void;
}

export interface VkHandoffHost {
  handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void>;
  registerClientChannel(channel: ClientChannel): void;
}

export class VkRuntime {
  private abortController: AbortController | undefined;
  private pollerPromise: Promise<void> | undefined;

  public constructor(
    private readonly handoffHost: VkHandoffHost,
    private readonly repository: SupportRepository,
    private readonly logger: VkRuntimeLogger,
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
    private readonly activity: ChannelActivityReporter = silentChannelActivityReporter,
  ) {}

  public get running(): boolean {
    return this.abortController !== undefined;
  }

  public async start(config: VkRuntimeConfig): Promise<void> {
    if (this.running) {
      throw new Error('VK is already connected');
    }
    const gateway = new VkApiClient(config.accessToken);
    await gateway.getLongPollServer(config.groupId);
    this.handoffHost.registerClientChannel(
      new VkClientChannel(gateway, this.information),
    );
    const poller = new VkPoller(
      gateway,
      config.groupId,
      new VkUpdateRouter(
        this.handoffHost,
        gateway,
        new VkClientMenu(gateway, this.repository, this.information),
      ),
      this.repository,
      {
        onError: (error) => {
          this.activity.recordPollFailed('vk', new Date());
          this.logger.error(error, 'VK update failed; retrying');
        },
        onSuccess: () => {
          this.activity.recordPollSucceeded('vk', new Date());
        },
        waitSeconds: config.pollTimeoutSeconds,
      },
    );
    const abortController = new AbortController();
    this.abortController = abortController;
    this.activity.recordPollerStarted('vk', new Date());
    this.pollerPromise = poller.run(abortController.signal).finally(() => {
      this.activity.recordPollerStopped('vk', new Date());
    });
    void this.pollerPromise.catch((error: unknown) => {
      if (!abortController.signal.aborted) {
        this.activity.recordPollFailed('vk', new Date());
        this.logger.error(error, 'VK poller stopped unexpectedly');
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
        this.logger.error(error, 'VK poller stopped during shutdown');
      }
    });
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
