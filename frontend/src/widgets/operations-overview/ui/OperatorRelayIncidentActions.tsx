import type {
  OperatorActionResolution,
  OperatorRelayIncident,
} from '@frontend-common/entities/operations/model/types';
import {
  actionButtonLabel,
  canRetryHeldReply,
  canUseWeb,
  isLifecycle,
  lifecycleResolutionLabel,
} from '@frontend-common/entities/operations/lib/operator-action-presentation';
import styles from '@frontend/widgets/operations-overview/styles/incident-list.module.css';

export function OperatorRelayIncidentActions({
  incident,
  pendingActionId,
  onResolve,
}: {
  incident: OperatorRelayIncident;
  pendingActionId: string;
  onResolve: (id: string, resolution: OperatorActionResolution) => void;
}) {
  const messageDelivery =
    incident.action === 'relay_message' ||
    incident.action === 'mirror_operator_message';
  const pending = pendingActionId === incident.id;
  const button = (
    resolution: OperatorActionResolution,
    label: string,
    secondary = false,
  ) => (
    <button
      key={resolution}
      className={secondary ? 'secondary-button' : undefined}
      type="button"
      disabled={Boolean(pendingActionId)}
      onClick={() => onResolve(incident.id, resolution)}
    >
      {actionButtonLabel(pending, label)}
    </button>
  );
  return (
    <div className={styles['delivery-resolution-actions']}>
      {messageDelivery && (
        <p>Проверьте Telegram-тему перед выбором действия.</p>
      )}
      {incident.action === 'relay_message' && !incident.confirmable && (
        <p>Не все сообщения появились в Telegram. Откройте обращение здесь.</p>
      )}
      {messageDelivery &&
        incident.confirmable &&
        button('received', 'Сообщение есть в Telegram', true)}
      {isLifecycle(incident) && incident.status === 'outcome_unknown' && (
        <>
          {button(
            'completed',
            lifecycleResolutionLabel(incident, 'completed'),
            true,
          )}
          {button(
            'not_completed',
            lifecycleResolutionLabel(incident, 'not_completed'),
          )}
        </>
      )}
      {canRetryHeldReply(incident) &&
        button('retry', 'Повторить открытие темы')}
      {canUseWeb(incident) && button('use_web', 'Открыть обращение здесь')}
    </div>
  );
}
