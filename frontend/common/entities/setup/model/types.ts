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
