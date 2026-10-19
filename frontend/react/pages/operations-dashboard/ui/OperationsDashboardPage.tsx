import { useOperationsDashboard } from '@frontend/pages/operations-dashboard/model/use-operations-dashboard';
import { OperationsOverview } from '@frontend/widgets/operations-overview/ui/OperationsOverview';
import { OperatorInbox } from '@frontend/widgets/operator-inbox/ui/OperatorInbox';
import { MessageFlowControl } from '@frontend/widgets/message-flow-control/ui/MessageFlowControl';
import { AsyncMessage } from '@frontend/shared/ui/AsyncMessage';
import styles from '@frontend/pages/operations-dashboard/styles/operations-dashboard-page.module.css';

export function OperationsDashboardPage() {
  const { status, control, inbox, actions, refresh, readError } =
    useOperationsDashboard();
  return (
    <section className={styles['ops-workspace']}>
      {readError && (
        <section
          className={`card message message--error ${styles['ops-refresh-error']}`}
          role="alert"
        >
          <p>{readError}</p>
          <button
            className="quiet"
            type="button"
            disabled={status.isFetching}
            onClick={() => void refresh()}
          >
            Повторить проверку
          </button>
        </section>
      )}
      <div className={styles['ops-toolbar']}>
        <p>Автообновление каждые 30 секунд</p>
        <button
          className="quiet"
          disabled={status.isFetching}
          type="button"
          onClick={() => void refresh()}
        >
          {status.isFetching ? 'Обновляем…' : 'Обновить'}
        </button>
      </div>
      <OperatorInbox inbox={inbox} />
      {status.data ? (
        <OperationsOverview
          status={status.data}
          statusUnavailable={
            status.isError || status.errorUpdatedAt > status.dataUpdatedAt
          }
          pendingDeliveryId={actions.delivery.pending}
          pendingOperatorActionId={actions.operator.pending}
          pendingInboundEventId={actions.inbound.pending}
          onRetryDelivery={actions.retryDelivery}
          onResolveDelivery={actions.resolveDelivery}
          onResolveOperatorAction={actions.resolveOperator}
          onResolveInboundEvent={actions.resolveInbound}
        />
      ) : status.isFetching ? (
        <section className={`card ${styles['loading-card']}`} role="status">
          <p>Проверяем работу каналов…</p>
        </section>
      ) : (
        <section className="card">
          <p>Состояние каналов неизвестно. Повторите проверку.</p>
        </section>
      )}
      {status.data && (
        <MessageFlowControl
          status={status.data}
          control={control.data}
          controlLoading={control.isFetching}
          pendingChannel={actions.intake.pending}
          pendingOutbound={actions.outbound.pending}
          onIntake={actions.changeIntake}
          onOutbound={actions.changeOutbound}
        />
      )}
      {[
        actions.delivery,
        actions.operator,
        actions.inbound,
        actions.intake,
        actions.outbound,
      ].map((action, index) => (
        <div key={index}>
          <AsyncMessage kind="error" text={action.error} />
          <AsyncMessage kind="success" text={action.notice} />
        </div>
      ))}
    </section>
  );
}
