import type {
  OperatorActionResolution,
  OperatorRelayIncident,
} from '@frontend/entities/operations/model/types';

export interface OperatorRelayIncidentListEmits {
  resolve: [actionId: string, resolution: OperatorActionResolution];
}

export interface OperatorRelayIncidentListProps {
  incidents: readonly OperatorRelayIncident[];
  pendingActionId: string | undefined;
}

export function actionButtonLabel(isPending: boolean, label: string): string {
  return isPending ? 'Выполняем…' : label;
}

export function canRetryHeldReply(incident: OperatorRelayIncident): boolean {
  return (
    incident.action === 'reopen_request' &&
    incident.heldReplyCount > 0 &&
    (incident.status === 'failed' || incident.status === 'abandoned')
  );
}

export function canUseWeb(incident: OperatorRelayIncident): boolean {
  return (
    incident.action === 'open_request' ||
    incident.action === 'relay_message' ||
    (incident.action === 'reopen_request' &&
      incident.heldReplyCount > 0 &&
      (incident.status === 'failed' || incident.status === 'abandoned'))
  );
}

export function isLifecycle(incident: OperatorRelayIncident): boolean {
  return (
    incident.action === 'close_request' || incident.action === 'reopen_request'
  );
}

export function lifecycleResolutionLabel(
  incident: OperatorRelayIncident,
  resolution: 'completed' | 'not_completed',
): string {
  if (incident.action === 'close_request') {
    return resolution === 'completed'
      ? 'Тема закрыта'
      : 'Тема осталась открыта';
  }
  return resolution === 'completed' ? 'Тема открыта' : 'Тема осталась закрыта';
}

export function operationLabel(incident: OperatorRelayIncident): string {
  if (incident.action === 'close_request') {
    return 'Закрытие Telegram-темы';
  }
  if (incident.action === 'reopen_request') {
    return 'Повторное открытие Telegram-темы';
  }
  if (incident.action === 'open_request') {
    return 'Создание Telegram-темы';
  }
  if (incident.action === 'mirror_operator_message') {
    return `Отражение ответа из VK, часть ${incident.sequence + 1}`;
  }
  return `Передача части ${incident.sequence + 1}`;
}
