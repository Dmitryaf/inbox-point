import { formatUptime } from '@frontend-common/entities/operations/lib/status-format';
import type { OperationsStatus } from '@frontend-common/entities/operations/model/types';
import base from '@frontend/widgets/operations-overview/styles/status-card.module.css';
import styles from '@frontend/widgets/operations-overview/styles/delivery-status-card.module.css';

const states = {
  paused: ['Отправка приостановлена', 'neutral'],
  failed: ['Есть ошибки', 'attention'],
  stalled: ['Отправка приостановлена', 'attention'],
  backlog: ['Ответы задерживаются', 'attention'],
  healthy: ['Работает', 'healthy'],
} as const;
export function DeliveryStatusCard({
  deliveries,
}: {
  deliveries: OperationsStatus['deliveries'];
}) {
  const [label, tone] = states[deliveries.state];
  return (
    <article className={`${base['status-card']} ${base['delivery-card']}`}>
      <div className={base['status-card-heading']}>
        <h3>Отправка ответов</h3>
        <span className={`status-pill status-pill--${tone}`}>{label}</span>
      </div>
      <dl className={styles['delivery-facts']}>
        <div>
          <dt>Ожидают отправки</dt>
          <dd>{deliveries.pending}</dd>
        </div>
        <div>
          <dt>Не доставлены</dt>
          <dd>{deliveries.failed}</dd>
        </div>
        {deliveries.uncertain > 0 && (
          <div>
            <dt>Требуют ручной проверки</dt>
            <dd>{deliveries.uncertain}</dd>
          </div>
        )}
        {deliveries.oldestPendingAgeSeconds !== undefined && (
          <div>
            <dt>Самое старое ожидание</dt>
            <dd>{formatUptime(deliveries.oldestPendingAgeSeconds)}</dd>
          </div>
        )}
      </dl>
      <details
        className={`${base['technical-details']} ${styles['status-technical-details']}`}
      >
        <summary>Технические данные</summary>
        <dl className={styles['delivery-facts']}>
          <div>
            <dt>Система отправки</dt>
            <dd>{deliveries.worker.running ? 'Запущена' : 'Остановлена'}</dd>
          </div>
        </dl>
      </details>
    </article>
  );
}
