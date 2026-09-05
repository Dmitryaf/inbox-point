import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface ClientIntakePolicy {
  isPaused(channel: ClientChannelKind): boolean;
}

export const acceptingClientIntakePolicy: ClientIntakePolicy = {
  isPaused: () => false,
};
