import { formatUptime } from '@frontend-common/entities/operations/lib/status-format';
import { formatShortDateTimeWithSeconds } from '@frontend-common/shared/lib/format-date-time';
import type { OverviewProps } from '@frontend/widgets/operations-overview/model/overview-props';
import styles from '@frontend/widgets/operations-overview/styles/operations-overview.module.css';
import { ChannelStatusCard } from './ChannelStatusCard';
import { DeliveryStatusCard } from './DeliveryStatusCard';
import { InboundEventStatusCard } from './InboundEventStatusCard';
import { OperationsAttentionPanel } from './OperationsAttentionPanel';

export function OperationsOverview(props: OverviewProps) {
  const { status, statusUnavailable } = props;
  const observedAt = formatShortDateTimeWithSeconds(status.observedAt);
  const label = statusUnavailable
    ? 'Состояние неизвестно'
    : status.state === 'healthy'
      ? 'Всё работает'
      : status.state === 'attention'
        ? 'Нужно проверить'
        : status.outbound.mode === 'paused'
          ? 'Ответы клиентам приостановлены'
          : 'Приём обращений приостановлен';
  const description = statusUnavailable
    ? `Не удалось обновить состояние. Показаны последние данные от ${observedAt}.`
    : status.state === 'healthy'
      ? 'Всё работает: каналы принимают сообщения, ответы отправляются.'
      : status.state === 'attention'
        ? 'Выше показано, что не работает и что нужно сделать.'
        : status.outbound.mode === 'paused'
          ? 'Ответы сохраняются и будут отправлены после возобновления.'
          : 'Новые обращения временно не создаются, активные диалоги продолжаются.';
  return (
    <section className={styles.overview} aria-labelledby="overview-title">
      <OperationsAttentionPanel {...props} />
      <article
        className={`${styles['service-summary']} ${statusUnavailable || status.state === 'attention' ? styles['service-summary--attention'] : ''} ${status.state === 'maintenance' ? styles['service-summary--maintenance'] : ''}`}
      >
        <div>
          <h2 id="overview-title">{label}</h2>
          <p className={styles['summary-description']}>{description}</p>
        </div>
        <dl className={styles['summary-facts']}>
          <div>
            <dt>Работает</dt>
            <dd>{formatUptime(status.uptimeSeconds)}</dd>
          </div>
          <div>
            <dt>Данные обновлены</dt>
            <dd>{observedAt}</dd>
          </div>
        </dl>
      </article>
      <div className={styles['status-grid']}>
        <ChannelStatusCard
          name="Telegram"
          channel={status.channels.telegram}
          intake={status.intake.telegram}
        />
        <ChannelStatusCard
          name="VK"
          channel={status.channels.vk}
          intake={status.intake.vk}
        />
        <DeliveryStatusCard deliveries={status.deliveries} />
        <InboundEventStatusCard inboundEvents={status.inboundEvents} />
      </div>
    </section>
  );
}
