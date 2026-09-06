import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './DeliveryIncidentList.model';
export function renderDeliveryIncidentListPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { formatCreatedAt, $emit } = $state;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {$props.incidents.length > 0 ? (
        <section
          {...$attributes}
          aria-labelledby="delivery-incidents-title"
          className={$class('delivery-incidents', $attributes.className)}
        >
          <h4 id="delivery-incidents-title">{'Недоставленные ответы'}</h4>
          <ol>
            {$renderList($props.incidents, (incident) => (
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
                  <div className="delivery-resolution-actions">
                    <p>{'Сначала уточните у клиента, был ли получен ответ.'}</p>
                    <button
                      type="button"
                      disabled={Boolean($props.pendingDeliveryId)}
                      onClick={() =>
                        void $emit('resolve', incident.id, 'received')
                      }
                      className="secondary-button"
                    >
                      {$props.pendingDeliveryId === incident.id
                        ? 'Сохраняем…'
                        : 'Клиент получил'}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean($props.pendingDeliveryId)}
                      onClick={() =>
                        void $emit('resolve', incident.id, 'not_received')
                      }
                    >
                      {$props.pendingDeliveryId === incident.id
                        ? 'Сохраняем…'
                        : 'Клиент не получил — повторить'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}
