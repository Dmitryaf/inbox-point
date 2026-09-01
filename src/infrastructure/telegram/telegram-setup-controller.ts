import type { TelegramRuntimeConfig } from '@/config/runtime-config.js';
import type { TelegramSettingsStore } from '@/infrastructure/persistence/telegram-settings-store.js';
import {
  TelegramApiClient,
  type TelegramOperatorChat,
} from '@/infrastructure/telegram/telegram-api-client.js';
import type { TelegramRuntimeControl } from '@/infrastructure/telegram/telegram-runtime.js';

export type TelegramSettingsSource = 'environment' | 'local' | 'none';

export interface TelegramSetupStatus {
  connected: boolean;
  locked: boolean;
  source: TelegramSettingsSource;
}

export class TelegramSetupController {
  private source: TelegramSettingsSource;

  public constructor(
    private readonly runtime: TelegramRuntimeControl,
    private readonly settingsStore: TelegramSettingsStore,
    source: TelegramSettingsSource,
  ) {
    this.source = source;
  }

  public status(): TelegramSetupStatus {
    return {
      connected: this.runtime.running,
      locked: this.source === 'environment' || this.runtime.running,
      source: this.source,
    };
  }

  public async discover(
    botToken: string,
  ): Promise<readonly TelegramOperatorChat[]> {
    this.assertMutable();
    return new TelegramApiClient(botToken).discoverOperatorChats();
  }

  public async connect(
    botToken: string,
    operatorChatId: number,
  ): Promise<void> {
    this.assertMutable();
    const config: TelegramRuntimeConfig = {
      botToken,
      operatorChatId,
      pollTimeoutSeconds: 30,
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
      throw new Error('Telegram is managed by server configuration');
    }
    if (this.runtime.running) {
      throw new Error('Telegram is already connected');
    }
  }
}
