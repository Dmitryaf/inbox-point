import type { OperationsStatus } from '@frontend-common/entities/operations/model/types';
import type {
  ClientChannel,
  ServiceControlState,
} from '@frontend-common/entities/service-control/model/types';
import { ChannelIntakeControls } from '@frontend/features/control-client-intake/ui/ChannelIntakeControls';
import { OutboundDeliveryControl } from '@frontend/features/control-outbound-delivery/ui/OutboundDeliveryControl';
import styles from '@frontend/widgets/message-flow-control/styles/message-flow-control.module.css';
import intake from '@frontend/features/control-client-intake/styles/client-intake-control.module.css';

export function MessageFlowControl({
  status,
  control,
  controlLoading,
  pendingChannel,
  pendingOutbound,
  onIntake,
  onOutbound,
}: {
  status: OperationsStatus;
  control: ServiceControlState | undefined;
  controlLoading: boolean;
  pendingChannel: string;
  pendingOutbound: string;
  onIntake: (channel: ClientChannel, mode: 'active' | 'paused') => void;
  onOutbound: (mode: 'pause' | 'resume') => void;
}) {
  return (
    <details className={`card ${styles['message-flow-control']}`}>
      <summary className={styles['message-flow-summary']}>
        <div>
          <h2>Управление сообщениями</h2>
        </div>
        <div className={styles['message-flow-summary-meta']}>
          <span className={styles['message-flow-summary-action']}>
            <span className={styles['message-flow-action--open']}>
              Открыть управление
            </span>
            <span className={styles['message-flow-action--close']}>
              Скрыть управление
            </span>
          </span>
          <span className="disclosure-chevron" aria-hidden="true" />
        </div>
      </summary>
      <div className={styles['message-flow-body']}>
        <section
          className={intake['client-intake-control']}
          aria-labelledby="intake-flow-title"
        >
          <p className="eyebrow">Клиент → администратор</p>
          <h3 id="intake-flow-title">Новые обращения</h3>
          <p className={intake['intake-control-intro']}>
            Для подключённых каналов пауза действует отдельно. Текущие обращения
            продолжат работать.
          </p>
          {control ? (
            <ChannelIntakeControls
              channels={status.channels}
              state={control}
              pendingChannel={pendingChannel}
              onChange={onIntake}
            />
          ) : controlLoading ? (
            <p className={intake['intake-control-state']} role="status">
              Проверяем режим работы…
            </p>
          ) : null}
        </section>
        <section
          className={styles['message-flow-outbound']}
          aria-labelledby="outbound-flow-title"
        >
          <h3 id="outbound-flow-title">Ответы клиентам</h3>
          <OutboundDeliveryControl
            outbound={status.outbound}
            pending={pendingOutbound}
            onChange={onOutbound}
          />
        </section>
      </div>
    </details>
  );
}
