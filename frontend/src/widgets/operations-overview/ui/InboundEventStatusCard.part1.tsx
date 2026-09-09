import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './InboundEventStatusCard.model';
export function renderInboundEventStatusCardPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { formatReceivedAt, $emit } = $state;

  return (
    <>
      {$props.inboundEvents.state === 'healthy' ? (
        <p>{' Необрабатываемых событий VK нет. '}</p>
      ) : (
        <section
          aria-labelledby="inbound-event-incidents-title"
          className="delivery-incidents"
        >
          <h4 id="inbound-event-incidents-title">{'Quarantine VK'}</h4>
          <ol>
            {$renderList($props.inboundEvents.incidents, (incident) => (
              <li key={incident.eventId}>
                <div className="delivery-incident-heading">
                  <strong>{incident.channel}</strong>
                  <time dateTime={incident.receivedAt}>
                    {formatReceivedAt(incident.receivedAt)}
                  </time>
                </div>
                <p>
                  {'Событие не обработано после '}
                  {incident.attempts}
                  {' попыток.'}
                </p>
                <details className="technical-details">
                  <summary>{'Технические данные'}</summary>
                  <dl className="delivery-incident-context">
                    <div>
                      <dt>{'ID события'}</dt>
                      <dd>{incident.eventId}</dd>
                    </div>
                    <div>
                      <dt>{'Причина'}</dt>
                      <dd>{incident.reason}</dd>
                    </div>
                  </dl>
                </details>
                <div className="delivery-resolution-actions">
                  <button
                    type="button"
                    disabled={Boolean($props.pendingEventId)}
                    onClick={() =>
                      void $emit(
                        'resolve',
                        incident.eventId,
                        incident.source,
                        'retry',
                      )
                    }
                    className="secondary-button"
                  >
                    {$props.pendingEventId === incident.eventId
                      ? 'Сохраняем…'
                      : 'Повторить'}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean($props.pendingEventId)}
                    onClick={() =>
                      void $emit(
                        'resolve',
                        incident.eventId,
                        incident.source,
                        'skip',
                      )
                    }
                  >
                    {$props.pendingEventId === incident.eventId
                      ? 'Сохраняем…'
                      : 'Пропустить'}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
