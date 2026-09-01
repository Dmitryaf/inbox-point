import type { VkRuntimeConfig } from '@/config/runtime-config.js';
import type { VkSettingsStore } from '@/infrastructure/persistence/vk-settings-store.js';

import { VkApiClient } from './vk-api-client.js';

export type VkSettingsSource = 'environment' | 'local' | 'none';

export interface VkRuntimeControl {
  readonly running: boolean;
  start(config: VkRuntimeConfig): Promise<void>;
  stop(): Promise<void>;
}

export class VkSetupController {
  private source: VkSettingsSource;

  public constructor(
    private readonly runtime: VkRuntimeControl,
    private readonly settingsStore: VkSettingsStore,
    source: VkSettingsSource,
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
    const client = new VkApiClient(accessToken);
    const config: VkRuntimeConfig = {
      accessToken,
      groupId: await client.resolveCommunity(community),
      pollTimeoutSeconds: 25,
    };
    await this.runtime.start(config);
    try {
      await this.settingsStore.save(config);
      this.source = 'local';
    } catch (error: unknown) {
      await this.runtime.stop();
      throw error;
    }
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
