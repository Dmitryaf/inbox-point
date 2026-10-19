import type { OperationsStatus } from '@frontend-common/entities/operations/model/types';
import styles from '@frontend/features/control-outbound-delivery/styles/outbound-delivery-control.module.css';
export function OutboundDeliveryControl({
  outbound,
  pending,
  onChange,
}: {
  outbound: OperationsStatus['outbound'];
  pending: string;
  onChange: (mode: 'pause' | 'resume') => void;
}) {
  const paused = outbound.mode === 'paused';
  return (
    <section className={styles['outbound-delivery-control']}>
      <div>
        <p>
          {paused
            ? 'Ответы не отправляются. Новые ответы сохраняются до возобновления.'
            : 'Ответы отправляются автоматически.'}
        </p>
      </div>
      <button
        className={paused ? undefined : 'danger'}
        type="button"
        disabled={Boolean(pending)}
        onClick={() => onChange(paused ? 'resume' : 'pause')}
      >
        {pending
          ? paused
            ? 'Возобновляем…'
            : 'Приостанавливаем…'
          : paused
            ? 'Возобновить ответы'
            : 'Приостановить ответы'}
      </button>
    </section>
  );
}
