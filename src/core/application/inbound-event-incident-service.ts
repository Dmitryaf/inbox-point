import type { SupportRepository } from '@/core/contracts/support-repository.js';

export type InboundEventResolution = 'retry' | 'skip';

export class InboundEventIncidentService {
  public constructor(private readonly repository: SupportRepository) {}

  public resolve(
    source: string,
    externalEventId: string,
    resolution: InboundEventResolution,
  ): boolean {
    return resolution === 'retry'
      ? this.repository.retryQuarantinedInboundEvent(source, externalEventId)
      : this.repository.skipQuarantinedInboundEvent(source, externalEventId);
  }
}
