import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface ClientIntakePolicy {
  isPaused(channel: ClientChannelKind): boolean;
}

export const pausedClientIntakeMessage =
  'Сейчас бот временно не принимает новые обращения. Попробуйте немного позже или свяжитесь по контакту, указанному в описании бота.';

export const acceptingClientIntakePolicy: ClientIntakePolicy = {
  isPaused: () => false,
};
