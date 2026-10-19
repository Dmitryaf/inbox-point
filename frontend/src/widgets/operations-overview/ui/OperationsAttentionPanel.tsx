import { Link } from 'react-router';
import {
  channelProblem,
  type ChannelProblem,
} from '@frontend-common/entities/operations/lib/operations-attention';
import type { OverviewProps } from '@frontend/widgets/operations-overview/model/overview-props';
import styles from '@frontend/widgets/operations-overview/styles/operations-attention-panel.module.css';
import { ConnectionSetupGuide } from './ConnectionSetupGuide';
import { DeliveryIncidentList } from './DeliveryIncidentList';
import { InboundEventIncidentList } from './InboundEventIncidentList';
import { OperatorInboxAttention } from './OperatorInboxAttention';
import { OperatorRelayIncidentList } from './OperatorRelayIncidentList';

export function OperationsAttentionPanel(props: OverviewProps) {
  const { status } = props;
  const problems = [
    channelProblem('Telegram', status.channels.telegram),
    channelProblem('VK', status.channels.vk),
  ].filter((item): item is ChannelProblem => Boolean(item));
  const setup = problems.filter((problem) => problem.kind === 'setup');
  const connection = problems.filter(
    (problem) => problem.kind === 'connection',
  );
  const stopped =
    status.deliveries.state === 'stalled' || !status.deliveries.worker.running;
  const operational =
    connection.length > 0 ||
    status.operatorInbox.state === 'attention' ||
    stopped ||
    status.deliveries.incidents.length > 0 ||
    status.operatorRelays.incidents.length > 0 ||
    status.inboundEvents.incidents.length > 0;
  if (!problems.length && !operational) {
    return null;
  }
  return (
    <section
      className={`card ${styles['attention-panel']} ${operational ? '' : styles['attention-panel--setup-only']}`}
      aria-labelledby="attention-title"
      aria-live="polite"
    >
      <header className={styles['attention-panel-heading']}>
        <h2 id="attention-title">
          {operational ? 'Требует внимания' : 'Закончите подключение'}
        </h2>
        <p>
          {operational
            ? 'Здесь собраны только проблемы, для которых нужно ваше решение.'
            : 'Сначала подключите Telegram: сотрудники будут отвечать в группе. Затем можно подключить VK для клиентов.'}
        </p>
      </header>
      {setup.length > 0 && <ConnectionSetupGuide problems={setup} />}
      {connection.length > 0 && (
        <div className={styles['attention-list']}>
          {connection.map((problem) => (
            <article key={problem.name}>
              <h3>{problem.name}</h3>
              <p>{problem.summary}</p>
              <p>{problem.action}</p>
              <Link to="/setup">Открыть «Каналы»</Link>
            </article>
          ))}
        </div>
      )}
      {stopped && (
        <div className={styles['attention-list']}>
          <article>
            <h3>Ответы сейчас не отправляются</h3>
            <p>Сохранённые ответы останутся в системе.</p>
            <p>
              Обновите страницу. Если отправка не началась, обратитесь к тому,
              кто установил приложение.
            </p>
          </article>
        </div>
      )}
      {status.operatorInbox.state === 'attention' && (
        <OperatorInboxAttention
          recoverableRequests={status.operatorInbox.recoverableWebRequests}
        />
      )}
      <DeliveryIncidentList
        incidents={status.deliveries.incidents}
        pendingDeliveryId={props.pendingDeliveryId}
        onResolve={props.onResolveDelivery}
        onRetry={props.onRetryDelivery}
      />
      <OperatorRelayIncidentList
        incidents={status.operatorRelays.incidents}
        pendingActionId={props.pendingOperatorActionId}
        onResolve={props.onResolveOperatorAction}
      />
      <InboundEventIncidentList
        incidents={status.inboundEvents.incidents}
        pendingEventId={props.pendingInboundEventId}
        onResolve={props.onResolveInboundEvent}
      />
    </section>
  );
}
