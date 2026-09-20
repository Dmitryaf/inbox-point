export type ClientIntakeMode = 'active' | 'paused';

export interface ChannelIntakeState {
  changedAt?: string;
  mode: ClientIntakeMode;
}

export interface ServiceControlState {
  channels: {
    telegram: ChannelIntakeState;
    vk: ChannelIntakeState;
  };
  delivery: OutboundDeliveryState;
  expectedChannels?: {
    telegram: boolean;
    vk: boolean;
  };
}

export interface OutboundDeliveryState {
  changedAt?: string;
  mode: ClientIntakeMode;
}

export function createDefaultServiceControlState(): ServiceControlState {
  return {
    channels: {
      telegram: { mode: 'active' },
      vk: { mode: 'active' },
    },
    delivery: { mode: 'active' },
    expectedChannels: {
      telegram: false,
      vk: false,
    },
  };
}

export function copyServiceControlState(
  state: ServiceControlState,
): ServiceControlState {
  return {
    channels: {
      telegram: { ...state.channels.telegram },
      vk: { ...state.channels.vk },
    },
    delivery: { ...state.delivery },
    ...(state.expectedChannels
      ? { expectedChannels: { ...state.expectedChannels } }
      : {}),
  };
}
