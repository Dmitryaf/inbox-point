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
import {
  acceptingClientIntakePolicy,
  type ClientIntakePolicy,
} from '@/core/contracts/client-intake-policy.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import type { ChannelOperatorMessage } from '@/core/model/operator-message.js';

import { VkApiClient, type VkGateway } from './vk-api-client.js';
import { VkClientChannel } from './vk-client-channel.js';
import { VkClientMenu } from './vk-client-menu.js';
import { VkPoller } from './vk-poller.js';
import { VkUpdateRouter } from './vk-update-router.js';
import {
  assertVkLongPollReady,
  type VkLongPollReadinessGateway,
} from './vk-long-poll-readiness.js';

export interface VkRuntimeLogger {
  error(error: unknown, message: string): void;
}

export interface VkHandoffHost {
  handleChannelOperatorMessage(
    externalEventId: string,
    message: ChannelOperatorMessage,
  ): Promise<void>;
  handleClientMessage(
    externalEventId: string,
    message: SupportMessage,
  ): Promise<void>;
  registerClientChannel(channel: ClientChannel): () => void;
}

export class VkRuntime {
  private abortController: AbortController | undefined;
  private pollerPromise: Promise<void> | undefined;
  private unregisterClientChannel: (() => void) | undefined;

  public constructor(
    private readonly handoffHost: VkHandoffHost,
    private readonly repository: SupportRepository,
    private readonly logger: VkRuntimeLogger,
    private readonly information: ClientInformationResolver = new ClientInformationCatalog(),
    private readonly activity: ChannelActivityReporter = silentChannelActivityReporter,
    private readonly intakePolicy: ClientIntakePolicy = acceptingClientIntakePolicy,
    private readonly createGateway: (
      accessToken: string,
    ) => VkGateway & VkLongPollReadinessGateway = (accessToken) =>
      new VkApiClient(accessToken),
  ) {}

  public get running(): boolean {
    return this.abortController !== undefined;
  }

  public async start(config: VkRuntimeConfig): Promise<void> {
    if (this.running) {
      throw new Error('VK is already connected');
    }
    const gateway = this.createGateway(config.accessToken);
    await assertVkLongPollReady(gateway, config.groupId);
    const clientChannel = new VkClientChannel(
      gateway,
      this.repository,
      this.information,
      this.intakePolicy,
    );
    const poller = new VkPoller(
      gateway,
      config.groupId,
      new VkUpdateRouter(
        this.handoffHost,
        gateway,
        new VkClientMenu(
          gateway,
          this.repository,
          this.information,
          this.intakePolicy,
        ),
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
    const unregisterClientChannel =
      this.handoffHost.registerClientChannel(clientChannel);
    this.abortController = abortController;
    this.unregisterClientChannel = unregisterClientChannel;
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
    const unregisterClientChannel = this.unregisterClientChannel;
    this.abortController = undefined;
    this.pollerPromise = undefined;
    this.unregisterClientChannel = undefined;
    abortController?.abort();
    unregisterClientChannel?.();
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
