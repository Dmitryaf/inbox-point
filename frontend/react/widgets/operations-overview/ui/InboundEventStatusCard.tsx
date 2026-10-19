import type { InboundEventOperationsStatus } from '@frontend-common/entities/operations/model/types';
import base from '@frontend/widgets/operations-overview/styles/status-card.module.css';
export function InboundEventStatusCard({
  inboundEvents,
}: {
  inboundEvents: InboundEventOperationsStatus;
}) {
  const healthy = inboundEvents.state === 'healthy';
  return (
    <article className={`${base['status-card']} ${base['delivery-card']}`}>
      <div className={base['status-card-heading']}>
        <h3>Входящие сообщения</h3>
        <span
          className={`status-pill status-pill--${healthy ? 'healthy' : 'attention'}`}
        >
          {healthy ? 'Работает' : 'Нужна проверка'}
        </span>
      </div>
      <p>
        {healthy
          ? 'Новые сообщения обрабатываются автоматически.'
          : 'Подробности и доступные действия показаны выше.'}
      </p>
    </article>
  );
}
