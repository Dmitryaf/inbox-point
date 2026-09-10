import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';

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
  const { $emit } = $state;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {$props.incidents.length > 0 ? (
        <section
          {...$attributes}
          aria-labelledby="operator-relay-incidents-title"
          className={$class('delivery-incidents', $attributes.className)}
          data-r-e2822c38=""
        >
          <h3 id="operator-relay-incidents-title" data-r-e2822c38="">
            {'Новые обращения'}
          </h3>
          <p data-r-e2822c38="">
            {'Проверьте, появилось ли обращение у операторов в Telegram.'}
          </p>
          <ol data-r-e2822c38="">
            {$renderList($props.incidents, (incident) => (
              <li key={incident.id} data-r-e2822c38="">
                <div className="delivery-incident-heading" data-r-e2822c38="">
                  <strong data-r-e2822c38="">
                    {'Обращение из '}
                    {incident.channel}
                    {' требует решения'}
                  </strong>
                  <time dateTime={incident.createdAt} data-r-e2822c38="">
                    {$unref(formatShortDateTime)(incident.createdAt)}
                  </time>
                </div>
                <p data-r-e2822c38="">
                  {
                    'Не удалось точно определить, появилось ли сообщение у операторов.'
                  }
                </p>
                <details className="technical-details" data-r-e2822c38="">
                  <summary data-r-e2822c38="">{'Технические данные'}</summary>
                  <dl className="delivery-incident-context" data-r-e2822c38="">
                    <div data-r-e2822c38="">
                      <dt data-r-e2822c38="">{'ID обращения'}</dt>
                      <dd data-r-e2822c38="">{incident.requestId}</dd>
                    </div>
                    <div data-r-e2822c38="">
                      <dt data-r-e2822c38="">{'Причина'}</dt>
                      <dd data-r-e2822c38="">{incident.reason}</dd>
                    </div>
                    <div data-r-e2822c38="">
                      <dt data-r-e2822c38="">{'ID сообщения клиента'}</dt>
                      <dd data-r-e2822c38="">{incident.clientMessageId}</dd>
                    </div>
                    {incident.action === 'relay_message' ? (
                      <div data-r-e2822c38="">
                        <dt data-r-e2822c38="">{'ID темы Telegram'}</dt>
                        <dd data-r-e2822c38="">{incident.operatorTopicId}</dd>
                      </div>
                    ) : null}
                    <div data-r-e2822c38="">
                      <dt data-r-e2822c38="">{'Операция'}</dt>
                      <dd data-r-e2822c38="">
                        {incident.action === 'open_request'
                          ? 'Создание Telegram-темы'
                          : `Передача части ${incident.sequence + 1}`}
                      </dd>
                    </div>
                  </dl>
                </details>
                <div className="delivery-resolution-actions" data-r-e2822c38="">
                  {incident.action === 'relay_message' ? (
                    <p data-r-e2822c38="">
                      {' Проверьте Telegram-тему перед выбором действия. '}
                    </p>
                  ) : null}
                  {incident.action === 'relay_message' &&
                  !incident.confirmable ? (
                    <p data-r-e2822c38="">
                      {
                        ' Не все сообщения появились в Telegram. Откройте обращение здесь. '
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
                      data-r-e2822c38=""
                    >
                      {$props.pendingActionId === incident.id
                        ? 'Сохраняем…'
                        : 'Сообщение есть в Telegram'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={Boolean($props.pendingActionId)}
                    onClick={() =>
                      void $emit('resolve', incident.id, 'use_web')
                    }
                    data-r-e2822c38=""
                  >
                    {$props.pendingActionId === incident.id
                      ? 'Сохраняем…'
                      : 'Открыть обращение здесь'}
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
