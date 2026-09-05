export type SetupSource = 'environment' | 'local' | 'none';

export interface ChannelSetupStatus {
  connected: boolean;
  locked: boolean;
  source: SetupSource;
}

export interface SetupStatus extends ChannelSetupStatus {
  vk: ChannelSetupStatus;
}

export interface TelegramOperatorChat {
  id: number;
  isForum: boolean;
  title: string;
}

export interface DeliveryFailure {
  attempts: number;
  channel: 'Telegram' | 'VK';
  createdAt: string;
  id: string;
  reason: string;
  retryAllowed: boolean;
}

export interface DeliveryStatus {
  failures: DeliveryFailure[];
  summary: {
    failed: number;
    pending: number;
    uncertain?: number;
  };
}

export interface BackupResult {
  createdAt: string;
  fileName: string;
}
