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
}

export function createDefaultServiceControlState(): ServiceControlState {
  return {
    channels: {
      telegram: { mode: 'active' },
      vk: { mode: 'active' },
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
  };
}
