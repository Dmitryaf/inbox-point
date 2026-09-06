import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './DeliveryStatusCard.model';
export function renderDeliveryStatusCardPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { formatCreatedAt, $emit } = $state;

  return (
    <>
      {$props.deliveries.incidents.length > 0 ? (
        <section
          aria-labelledby="delivery-incidents-title"
          className="delivery-incidents"
        >
          <h4 id="delivery-incidents-title">{'Недоставленные ответы'}</h4>
          <ol>
            {$renderList($props.deliveries.incidents, (incident) => (
              <li key={incident.id}>
                <div className="delivery-incident-heading">
                  <strong>{incident.channel}</strong>
                  <time dateTime={incident.createdAt}>
                    {formatCreatedAt(incident.createdAt)}
                  </time>
                </div>
                <p>{incident.reason}</p>
                <dl className="delivery-incident-context">
                  <div>
                    <dt>{'Обращение'}</dt>
                    <dd>{incident.requestId}</dd>
                  </div>
                  <div>
                    <dt>{'Тема преподавателя'}</dt>
                    <dd>{incident.operatorTopicId}</dd>
                  </div>
                  {incident.operatorMessageId ? (
                    <div>
                      <dt>{'Сообщение преподавателя'}</dt>
                      <dd>{incident.operatorMessageId}</dd>
                    </div>
                  ) : null}
                </dl>
                {incident.retryAllowed ? (
                  <button
                    type="button"
                    disabled={Boolean($props.pendingDeliveryId)}
                    onClick={() => void $emit('retry', incident.id)}
                    className="secondary-button"
                  >
                    {$props.pendingDeliveryId === incident.id
                      ? 'Ставим в очередь…'
                      : 'Повторить доставку'}
                  </button>
                ) : (
                  <p className="delivery-incident-note">
                    {
                      ' Уточните получение через тему обращения. Повтор без проверки может отправить клиенту дубликат. '
                    }
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}
