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
} from './OperatorRelayIncidentList.model';
export function renderOperatorRelayIncidentListPart1(
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
          aria-labelledby="operator-relay-incidents-title"
          className={$class('delivery-incidents', $attributes.className)}
        >
          <h4 id="operator-relay-incidents-title">
            {' Передача обращений требует проверки '}
          </h4>
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
                <details className="technical-details">
                  <summary>{'Технические данные'}</summary>
                  <dl className="delivery-incident-context">
                    <div>
                      <dt>{'ID обращения'}</dt>
                      <dd>{incident.requestId}</dd>
                    </div>
                    <div>
                      <dt>{'ID сообщения клиента'}</dt>
                      <dd>{incident.clientMessageId}</dd>
                    </div>
                    {incident.action === 'relay_message' ? (
                      <div>
                        <dt>{'ID темы Telegram'}</dt>
                        <dd>{incident.operatorTopicId}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>{'Операция'}</dt>
                      <dd>
                        {incident.action === 'open_request'
                          ? 'Создание Telegram-темы'
                          : `Передача части ${incident.sequence + 1}`}
                      </dd>
                    </div>
                  </dl>
                </details>
                <div className="delivery-resolution-actions">
                  {incident.action === 'relay_message' ? (
                    <p>{' Проверьте Telegram-тему перед выбором действия. '}</p>
                  ) : null}
                  {incident.action === 'relay_message' &&
                  !incident.confirmable ? (
                    <p>
                      {
                        ' Передача остальных частей не подтверждена. Используйте web inbox. '
                      }
                    </p>
                  ) : null}
                  {incident.action === 'relay_message' &&
                  incident.confirmable ? (
                    <button
                      type="button"
                      disabled={Boolean($props.pendingActionId)}
                      onClick={() =>
                        void $emit('resolve', incident.id, 'received')
                      }
                      className="secondary-button"
                    >
                      {$props.pendingActionId === incident.id
                        ? 'Сохраняем…'
                        : 'Сообщение видно в Telegram'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={Boolean($props.pendingActionId)}
                    onClick={() =>
                      void $emit('resolve', incident.id, 'use_web')
                    }
                  >
                    {$props.pendingActionId === incident.id
                      ? 'Сохраняем…'
                      : 'Работать в web inbox'}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}
