import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface ClientIntakePolicy {
  isPaused(channel: ClientChannelKind): boolean;
}

export const pausedClientIntakeMessage =
  'Сейчас новые обращения временно не принимаются. Попробуйте немного позже.';

export const acceptingClientIntakePolicy: ClientIntakePolicy = {
  isPaused: () => false,
};
