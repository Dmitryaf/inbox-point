import type {
  OperatorActionIncident,
  OperatorActionSummary,
} from '@/core/model/operator-action.js';
import type { OperatorRelayOperationsStatus } from '@/modules/operations-monitoring/model/operations-status.js';

export function mapOperatorRelayStatus(
  summary: OperatorActionSummary,
  incidents: readonly OperatorActionIncident[],
): OperatorRelayOperationsStatus {
  return {
    incidents: incidents.map((incident) => ({
      action: incident.kind,
      channel: incident.channel === 'telegram' ? 'Telegram' : 'VK',
      clientMessageId: incident.clientMessageId,
      confirmable: incident.confirmable,
      createdAt: incident.createdAt.toISOString(),
      id: incident.id,
      initial: incident.initial,
      operatorTopicId: incident.operatorTopicId,
      reason:
        incident.kind === 'open_request'
          ? 'Telegram мог создать тему, но подтверждение не получено. Обращение сохранено в web inbox; проверьте группу и закройте возможный дубль.'
          : 'Telegram мог принять сообщение клиента. Не отправляйте его повторно: проверьте тему или переведите обращение в web inbox.',
      requestId: incident.requestId,
      sequence: incident.sequence,
    })),
    state: summary.uncertain > 0 ? 'uncertain' : 'healthy',
    uncertain: summary.uncertain,
  };
}
