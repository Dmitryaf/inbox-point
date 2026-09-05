export type ClientChannel = 'telegram' | 'vk';
export type ClientIntakeMode = 'active' | 'paused';

export interface ChannelIntakeState {
  changedAt?: string;
  mode: ClientIntakeMode;
}

export interface ServiceControlState {
  channels: Record<ClientChannel, ChannelIntakeState>;
}

export function parseServiceControlState(value: unknown): ServiceControlState {
  if (!isRecord(value) || !isRecord(value.channels)) {
    throw new Error('Сервис вернул некорректный режим приёма обращений.');
  }
  const telegram = parseChannelState(value.channels.telegram);
  const vk = parseChannelState(value.channels.vk);
  return {
    channels: { telegram, vk },
  };
}

function parseChannelState(value: unknown): ChannelIntakeState {
  if (
    !isRecord(value) ||
    (value.mode !== 'active' && value.mode !== 'paused') ||
    (value.changedAt !== undefined && typeof value.changedAt !== 'string')
  ) {
    throw new Error('Сервис вернул некорректный режим приёма обращений.');
  }
  return {
    ...(typeof value.changedAt === 'string'
      ? { changedAt: value.changedAt }
      : {}),
    mode: value.mode,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
