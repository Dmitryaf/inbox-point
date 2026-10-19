import type {
  OperatorActionResolution,
  OperatorRelayIncident,
} from '@frontend-common/entities/operations/model/types';
import {
  isLifecycle,
  operationLabel,
} from '@frontend-common/entities/operations/lib/operator-action-presentation';
import { formatShortDateTime } from '@frontend-common/shared/lib/format-date-time';
import styles from '@frontend/widgets/operations-overview/styles/incident-list.module.css';
import { OperatorRelayIncidentActions } from './OperatorRelayIncidentActions';
import { IncidentDetails } from './IncidentDetails';

export function OperatorRelayIncidentList({
  incidents,
  pendingActionId,
  onResolve,
}: {
  incidents: readonly OperatorRelayIncident[];
  pendingActionId: string;
  onResolve: (id: string, resolution: OperatorActionResolution) => void;
}) {
  if (!incidents.length) {
    return null;
  }
  return (
    <section
      className={styles['delivery-incidents']}
      aria-labelledby="operator-relay-incidents-title"
    >
      <h3 id="operator-relay-incidents-title">Действия в Telegram</h3>
      <p>Проверьте ситуацию и выберите доступное безопасное действие.</p>
      <ol>
        {incidents.map((incident) => (
          <li key={incident.id}>
            <div className={styles['delivery-incident-heading']}>
              <strong>
                {isLifecycle(incident)
                  ? 'Состояние темы требует решения'
                  : `Обращение из ${incident.channel} требует решения`}
              </strong>
              <time dateTime={incident.createdAt}>
                {formatShortDateTime(incident.createdAt)}
              </time>
            </div>
            <p>
              {incident.heldReplyCount > 0
                ? incident.reason
                : isLifecycle(incident)
                  ? 'Не удалось точно определить, изменилось ли состояние темы.'
                  : 'Не удалось точно определить, появилось ли сообщение у администраторов.'}
            </p>
            {incident.heldReplyCount > 1 && (
              <p>
                Сохранено ответов: {incident.heldReplyCount}. Они будут
                отправлены по порядку.
              </p>
            )}
            <p className={styles['incident-client']}>
              <strong>
                Клиент:{' '}
                {incident.displayName?.length
                  ? incident.displayName
                  : 'Имя не указано'}{' '}
                · {incident.channel}
              </strong>
            </p>
            {!isLifecycle(incident) && (
              <div className={styles['incident-message']}>
                <strong>
                  {incident.action === 'mirror_operator_message'
                    ? 'Исходный ответ из VK'
                    : 'Исходное сообщение клиента'}
                </strong>
                <p>{incident.messageText ?? 'Текст сообщения недоступен'}</p>
                <small>
                  Проверяется часть {incident.sequence + 1} сообщения.
                </small>
              </div>
            )}
            <IncidentDetails
              facts={[
                ['ID обращения', incident.requestId],
                ['Причина', incident.reason],
                [
                  incident.action === 'mirror_operator_message'
                    ? 'ID ответа VK'
                    : 'ID сообщения клиента',
                  incident.clientMessageId,
                ],
                ...(incident.action !== 'open_request'
                  ? [['ID темы Telegram', incident.operatorTopicId] as const]
                  : []),
                ['Операция', operationLabel(incident)],
              ]}
            />
            <OperatorRelayIncidentActions
              incident={incident}
              pendingActionId={pendingActionId}
              onResolve={onResolve}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
