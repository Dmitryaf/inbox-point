import type { VkRuntimeConfig } from '@/config/runtime-config.js';
import type { VkSettingsStore } from '@/infrastructure/persistence/vk-settings-store.js';

import { VkApiClient } from './vk-api-client.js';

export type VkSettingsSource = 'environment' | 'local' | 'none';

export interface VkRuntimeControl {
  readonly running: boolean;
  start(config: VkRuntimeConfig): Promise<void>;
  stop(): Promise<void>;
}

export interface VkSetupGateway {
  getLongPollServer(groupId: number): Promise<unknown>;
  getLongPollSettings(groupId: number): Promise<{
    enabled: boolean;
    messageNew: boolean;
  }>;
  getTokenPermissions(): Promise<{ names: readonly string[] }>;
  resolveCommunity(reference: string): Promise<number>;
}

export class VkSetupController {
  private source: VkSettingsSource;

  public constructor(
    private readonly runtime: VkRuntimeControl,
    private readonly settingsStore: VkSettingsStore,
    source: VkSettingsSource,
    private readonly createGateway: (accessToken: string) => VkSetupGateway = (
      accessToken,
    ) => new VkApiClient(accessToken),
  ) {
    this.source = source;
  }

  public status(): {
    connected: boolean;
    locked: boolean;
    source: VkSettingsSource;
  } {
    return {
      connected: this.runtime.running,
      locked: this.source === 'environment' || this.runtime.running,
      source: this.source,
    };
  }

  public async connect(accessToken: string, community: string): Promise<void> {
    this.assertMutable();
    const client = this.createGateway(accessToken);
    const permissions = await client.getTokenPermissions();
    assertRequiredPermissions(permissions.names);
    const config: VkRuntimeConfig = {
      accessToken,
      groupId: await client.resolveCommunity(community),
      pollTimeoutSeconds: 25,
    };
    const longPoll = await client.getLongPollSettings(config.groupId);
    if (!longPoll.enabled) {
      throw new Error('VK Long Poll is disabled');
    }
    if (!longPoll.messageNew) {
      throw new Error('VK Long Poll message_new event is disabled');
    }
    await client.getLongPollServer(config.groupId);
    await this.runtime.start(config);
    try {
      await this.settingsStore.save(config);
      this.source = 'local';
    } catch (error: unknown) {
      await this.runtime.stop();
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.source === 'environment') {
      throw new Error('VK is managed by server configuration');
    }
    if (this.source === 'none') {
      return;
    }
    await this.runtime.stop();
    await this.settingsStore.clear();
    this.source = 'none';
  }

  private assertMutable(): void {
    if (this.source === 'environment') {
      throw new Error('VK is managed by server configuration');
    }
    if (this.runtime.running) {
      throw new Error('VK is already connected');
    }
  }
}

function assertRequiredPermissions(permissions: readonly string[]): void {
  if (!permissions.includes('manage')) {
    throw new Error('VK access token is missing manage permission');
  }
  if (!permissions.includes('messages')) {
    throw new Error('VK access token is missing messages permission');
  }
}
