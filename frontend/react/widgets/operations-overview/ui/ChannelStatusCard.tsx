import { connectionSourceLabel } from '@frontend-common/entities/operations/lib/status-format';
import type {
  ChannelOperationsStatus,
  ClientIntakeOperationsStatus,
} from '@frontend-common/entities/operations/model/types';
import base from '@frontend/widgets/operations-overview/styles/status-card.module.css';
import styles from '@frontend/widgets/operations-overview/styles/channel-status-card.module.css';
import { ChannelDiagnostics } from './ChannelDiagnostics';

const states = {
  configuration_missing: ['Нужно подключить', 'attention'],
  not_configured: ['Не настроен', 'neutral'],
  poll_failed: ['Ошибка связи', 'attention'],
  poll_stale: ['Нет свежих данных', 'attention'],
  running: ['Работает', 'healthy'],
  starting: ['Запускается', 'neutral'],
  stopped: ['Не работает', 'attention'],
} as const;
export function ChannelStatusCard({
  channel,
  intake,
  name,
}: {
  channel: ChannelOperationsStatus;
  intake: ClientIntakeOperationsStatus;
  name: string;
}) {
  const [label, tone] = states[channel.state];
  return (
    <article className={base['status-card']}>
      <div className={base['status-card-heading']}>
        <h3>{name}</h3>
        <span className={`status-pill status-pill--${tone}`}>{label}</span>
      </div>
      <p>{connectionSourceLabel(channel.source)}</p>
      {intake.mode === 'paused' && (
        <p className={styles['channel-maintenance-note']}>
          Новые обращения приостановлены вручную.
        </p>
      )}
      {channel.configured && <ChannelDiagnostics channel={channel} />}
    </article>
  );
}
