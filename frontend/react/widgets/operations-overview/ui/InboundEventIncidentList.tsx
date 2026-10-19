import type { InboundEventIncident } from '@frontend-common/entities/operations/model/types';
import { formatShortDateTime } from '@frontend-common/shared/lib/format-date-time';
import styles from '@frontend/widgets/operations-overview/styles/incident-list.module.css';
import { IncidentDetails } from './IncidentDetails';

export function InboundEventIncidentList({
  incidents,
  pendingEventId,
  onResolve,
}: {
  incidents: readonly InboundEventIncident[];
  pendingEventId: string;
  onResolve: (id: string, source: string, resolution: 'retry' | 'skip') => void;
}) {
  if (!incidents.length) {
    return null;
  }
  return (
    <section
      className={styles['delivery-incidents']}
      aria-labelledby="inbound-event-incidents-title"
    >
      <h3 id="inbound-event-incidents-title">
        Необработанные сообщения и действия
      </h3>
      <p>
        Некоторые сообщения или действия в каналах не удалось обработать
        автоматически. Проверьте сведения и выберите подходящее действие.
      </p>
      <ol>
        {incidents.map((incident) => (
          <li key={`${incident.source}:${incident.eventId}`}>
            <div className={styles['delivery-incident-heading']}>
              <strong>Нужна проверка: {incident.channel}</strong>
              <time dateTime={incident.receivedAt}>
                {formatShortDateTime(incident.receivedAt)}
              </time>
            </div>
            <p>
              {incident.channel === 'Telegram'
                ? 'Перед повтором проверьте чат: предыдущий ответ бота мог быть отправлен. Если он уже есть, выберите «Не обрабатывать».'
                : 'После повторной обработки сообщение может появиться у администратора. Если повтор точно не нужен, выберите «Не обрабатывать».'}
            </p>
            <IncidentDetails
              facts={[
                ['ID события', incident.eventId],
                ['Попыток обработки', incident.attempts],
                ['Источник', incident.source],
                ['Причина', incident.reason],
              ]}
            />
            <div className={styles['delivery-resolution-actions']}>
              <button
                type="button"
                disabled={Boolean(pendingEventId)}
                onClick={() =>
                  onResolve(incident.eventId, incident.source, 'retry')
                }
              >
                {pendingEventId === incident.eventId
                  ? 'Повторяем…'
                  : 'Повторить обработку'}
              </button>
              <button
                className="quiet-danger"
                type="button"
                disabled={Boolean(pendingEventId)}
                onClick={() =>
                  onResolve(incident.eventId, incident.source, 'skip')
                }
              >
                {pendingEventId === incident.eventId
                  ? 'Сохраняем…'
                  : 'Не обрабатывать'}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
