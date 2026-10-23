import type { DeliveryIncident } from '@frontend-common/entities/operations/model/types';
import { formatShortDateTime } from '@frontend-common/shared/lib/format-date-time';
import styles from '@frontend/widgets/operations-overview/styles/incident-list.module.css';
import { IncidentDetails } from './IncidentDetails';

export function DeliveryIncidentList({
  incidents,
  pendingDeliveryId,
  onRetry,
  onResolve,
}: {
  incidents: readonly DeliveryIncident[];
  pendingDeliveryId: string;
  onRetry: (id: string) => void;
  onResolve: (id: string, resolution: 'not_received' | 'received') => void;
}) {
  if (!incidents.length) {
    return null;
  }
  return (
    <section
      className={styles['delivery-incidents']}
      aria-labelledby="delivery-incidents-title"
    >
      <h3 id="delivery-incidents-title">Ответы клиентам</h3>
      <p>Эти ответы не дошли или требуют ручной проверки.</p>
      <ol>
        {incidents.map((incident) => (
          <li key={incident.id}>
            <div className={styles['delivery-incident-heading']}>
              <strong>
                {incident.retryAllowed
                  ? `Ответ в ${incident.channel} не доставлен`
                  : `Доставку в ${incident.channel} нужно проверить`}
              </strong>
              <time dateTime={incident.createdAt}>
                {formatShortDateTime(incident.createdAt)}
              </time>
            </div>
            <p>
              {incident.retryAllowed
                ? 'Ответ не дошёл до клиента. Попробуйте отправить его ещё раз.'
                : 'Не удалось узнать, получил ли клиент ответ. Сначала проверьте переписку, затем выберите подходящее действие.'}
            </p>
            <p className={styles['incident-client']}>
              <strong>
                Клиент:{' '}
                {incident.displayName?.length
                  ? incident.displayName
                  : 'Имя не указано'}{' '}
                · {incident.channel}
              </strong>
            </p>
            <div className={styles['incident-message']}>
              <strong>Ответ клиенту</strong>
              <p>{incident.messageText ?? 'Текст ответа недоступен'}</p>
            </div>
            <IncidentDetails
              facts={[
                ['ID обращения', incident.requestId],
                ['ID темы в Telegram', incident.operatorTopicId],
                ...(incident.operatorMessageId
                  ? [['ID сообщения', incident.operatorMessageId] as const]
                  : []),
                ['Причина', incident.reason],
              ]}
            />
            {incident.retryAllowed ? (
              <button
                type="button"
                disabled={Boolean(pendingDeliveryId)}
                onClick={() => onRetry(incident.id)}
              >
                {pendingDeliveryId === incident.id
                  ? 'Начинаем отправку…'
                  : 'Повторить отправку'}
              </button>
            ) : (
              <div className={styles['delivery-resolution-actions']}>
                <p>Сначала проверьте, было ли получено сообщение.</p>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={Boolean(pendingDeliveryId)}
                  onClick={() => onResolve(incident.id, 'received')}
                >
                  {pendingDeliveryId === incident.id
                    ? 'Сохраняем…'
                    : 'Сообщение получено'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(pendingDeliveryId)}
                  onClick={() => onResolve(incident.id, 'not_received')}
                >
                  {pendingDeliveryId === incident.id
                    ? 'Сохраняем…'
                    : 'Не получено — повторить'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
