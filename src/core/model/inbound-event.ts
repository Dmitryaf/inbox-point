export interface PendingInboundEvent {
  externalEventId: string;
  payload: string;
  receivedAt: Date;
  source: string;
}

export interface QueuedInboundEvent extends PendingInboundEvent {
  attempts: number;
  nextAttemptAt?: Date;
}

export interface InboundEventIncident {
  attempts: number;
  externalEventId: string;
  lastError: string;
  receivedAt: Date;
  source: string;
}

export interface InboundEventSummary {
  quarantined: number;
}

export type InboundEventFailureOutcome = 'quarantined' | 'retry';
