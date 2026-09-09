import { enqueueHandoffAcknowledgement } from '@/core/application/handoff-acknowledgement.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { OperatorActionIncident } from '@/core/model/operator-action.js';

export type OperatorActionResolution = 'received' | 'use_web';

export class OperatorActionIncidentService {
  private readonly clock: () => Date;

  public constructor(
    private readonly repository: SupportRepository,
    clock: () => Date = () => new Date(),
  ) {
    this.clock = clock;
  }

  public resolve(
    actionId: string,
    resolution: OperatorActionResolution,
  ): boolean {
    const incident = this.repository.findOperatorActionIncident(actionId);
    if (!incident) {
      return false;
    }

    if (resolution === 'received') {
      return this.confirmReceived(incident);
    }
    return this.moveToWeb(incident);
  }

  private confirmReceived(incident: OperatorActionIncident): boolean {
    if (incident.kind !== 'relay_message') {
      return false;
    }
    const now = this.clock();
    const confirmed = this.repository.confirmOperatorActionReceived(
      incident.id,
      now,
    );
    if (!confirmed) {
      return false;
    }
    if (
      incident.initial &&
      !this.repository.hasUnknownOperatorActions(
        incident.requestId,
        incident.clientMessageId,
      )
    ) {
      enqueueHandoffAcknowledgement(
        this.repository,
        {
          channel: incident.channel,
          conversationId: incident.conversationId,
          id: incident.requestId,
        },
        now,
      );
    }
    return true;
  }

  private moveToWeb(incident: OperatorActionIncident): boolean {
    const moved = this.repository.moveOperatorActionRequestToWeb(incident.id);
    if (!moved) {
      return false;
    }

    const now = this.clock();
    this.repository.recordUsageEvent({
      channel: incident.channel,
      id: `web-takeover:${incident.requestId}`,
      occurredAt: now,
      requestId: incident.requestId,
      type: 'web_takeover',
    });
    if (incident.initial) {
      enqueueHandoffAcknowledgement(
        this.repository,
        {
          channel: incident.channel,
          conversationId: incident.conversationId,
          id: incident.requestId,
        },
        now,
      );
    }
    return this.repository.resolveOperatorActionAsWeb(incident.id, now);
  }
}
