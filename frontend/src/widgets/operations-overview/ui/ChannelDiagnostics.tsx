import type { ReactNode } from 'react';
import type { ChannelOperationsStatus } from '@frontend-common/entities/operations/model/types';
import { formatStatusTime } from '@frontend-common/entities/operations/lib/status-format';
import base from '@frontend/widgets/operations-overview/styles/status-card.module.css';
import styles from '@frontend/widgets/operations-overview/styles/channel-status-card.module.css';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
export function ChannelDiagnostics({
  channel,
}: {
  channel: ChannelOperationsStatus;
}) {
  const failure = channel.lastFailure;
  const request = failure?.request;
  return (
    <details
      className={`${base['technical-details']} ${styles['channel-details']}`}
    >
      <summary>Технические данные</summary>
      <dl className={styles['channel-activity']}>
        <Fact label="Последняя успешная проверка">
          {formatStatusTime(channel.lastSuccessfulPollAt)}
        </Fact>
        {channel.lastFailedPollAt && (
          <Fact label="Последняя ошибка связи">
            {formatStatusTime(channel.lastFailedPollAt)}
          </Fact>
        )}
        {Boolean(channel.consecutiveFailures) && (
          <Fact label="Ошибок подряд">{channel.consecutiveFailures}</Fact>
        )}
        {channel.lastRecoveredAt && (
          <Fact label="Связь восстановлена">
            {formatStatusTime(channel.lastRecoveredAt)}
          </Fact>
        )}
        {failure && (
          <Fact label="Последний сбой">
            {failure.stage === 'startup'
              ? 'При подключении'
              : 'При получении данных'}
          </Fact>
        )}
        {request && (
          <>
            <Fact label="Метод API">{request.method}</Fact>
            <Fact label="Тип ошибки">
              {
                {
                  transport: 'Ошибка соединения',
                  http: 'Отказ HTTP',
                  api: 'Отказ API',
                  invalid_response: 'Некорректный ответ',
                }[request.kind]
              }
            </Fact>
            <Fact label="Длительность запроса">{request.durationMs} мс</Fact>
            {request.transportCodes.length > 0 && (
              <Fact label="Сетевой код">
                {request.transportCodes.join(', ')}
              </Fact>
            )}
            {Boolean(request.httpStatus) && (
              <Fact label="HTTP">{request.httpStatus}</Fact>
            )}
            {request.apiCode !== undefined && (
              <Fact label="Код API">{request.apiCode}</Fact>
            )}
            <Fact label="ID операции">{request.operationId}</Fact>
          </>
        )}
      </dl>
    </details>
  );
}
