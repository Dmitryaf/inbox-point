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
      heldReplyCount: incident.heldReplyCount,
      id: incident.id,
      initial: incident.initial,
      operatorTopicId: incident.operatorTopicId,
      reason: operatorActionReason(incident),
      requestId: incident.requestId,
      sequence: incident.sequence,
      status: incident.status,
    })),
    state: incidents.length > 0 ? 'uncertain' : 'healthy',
    uncertain: summary.uncertain,
  };
}

function operatorActionReason(incident: OperatorActionIncident): string {
  if (incident.kind === 'close_request') {
    return 'Telegram мог закрыть тему, но подтверждение не получено. Обращение пока оставлено открытым в Inbox Point.';
  }
  if (incident.kind === 'reopen_request' && incident.heldReplyCount > 0) {
    if (incident.status === 'failed') {
      return 'Открыть Telegram-тему не удалось. Ответ сохранён, повторно отправлять его не нужно. Можно повторить открытие или продолжить обращение здесь.';
    }
    if (incident.status === 'abandoned') {
      return 'Подтверждено, что тема осталась закрыта. Ответ сохранён, повторно отправлять его не нужно. Можно повторить открытие или продолжить обращение здесь.';
    }
    return 'Не удалось подтвердить открытие Telegram-темы. Ответ оператора сохранён и будет отправлен после разрешения ситуации.';
  }
  if (incident.kind === 'reopen_request') {
    return 'Telegram мог открыть тему, но подтверждение не получено. Обращение пока оставлено закрытым в Inbox Point.';
  }
  if (incident.kind === 'open_request') {
    return 'Telegram мог создать тему, но подтверждение не получено. Обращение сохранено в web inbox; проверьте группу и закройте возможный дубль.';
  }
  if (incident.kind === 'mirror_operator_message') {
    return 'Telegram мог отразить ответ, отправленный из VK, но подтверждение не получено. Не отправляйте его повторно: проверьте тему.';
  }
  return 'Telegram мог принять сообщение клиента. Не отправляйте его повторно: проверьте тему или переведите обращение в web inbox.';
}
