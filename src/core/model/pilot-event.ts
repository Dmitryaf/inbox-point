import type { ClientChannelKind } from './support-message.js';

export const pilotEventTypes = [
  'new_request',
  'information_section',
  'first_reply',
  'delivery_failure',
  'web_takeover',
] as const;

export type PilotEventType = (typeof pilotEventTypes)[number];

export interface PilotEvent {
  channel: ClientChannelKind;
  id: string;
  occurredAt: Date;
  requestId?: string;
  type: PilotEventType;
}

export type PilotEventCounts = Record<PilotEventType, number>;
