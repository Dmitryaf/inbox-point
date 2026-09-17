import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';
import {
  isLifecycle,
  operationLabel,
} from '@frontend/widgets/operations-overview/model/operator-action-presentation';
import OperatorRelayIncidentActions from './OperatorRelayIncidentActions';

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
            {'Действия в Telegram'}
          </h3>
          <p data-r-e2822c38="">
            {'Проверьте ситуацию и выберите доступное безопасное действие.'}
          </p>
          <ol data-r-e2822c38="">
            {$renderList($props.incidents, (incident) => (
              <li key={incident.id} data-r-e2822c38="">
                <div className="delivery-incident-heading" data-r-e2822c38="">
                  <strong data-r-e2822c38="">
                    {$unref(isLifecycle)(incident)
                      ? 'Состояние темы требует решения'
                      : `Обращение из ${incident.channel} требует решения`}
                  </strong>
                  <time dateTime={incident.createdAt} data-r-e2822c38="">
                    {$unref(formatShortDateTime)(incident.createdAt)}
                  </time>
                </div>
                {incident.heldReplyCount > 0 ? (
                  <p data-r-e2822c38="">{incident.reason}</p>
                ) : (
                  <p data-r-e2822c38="">
                    {$unref(isLifecycle)(incident)
                      ? 'Не удалось точно определить, изменилось ли состояние темы.'
                      : 'Не удалось точно определить, появилось ли сообщение у операторов.'}
                  </p>
                )}
                {incident.heldReplyCount > 1 ? (
                  <p data-r-e2822c38="">
                    {' Сохранено ответов: '}
                    {incident.heldReplyCount}
                    {'. Они будут отправлены по порядку. '}
                  </p>
                ) : null}
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
                      <dt data-r-e2822c38="">
                        {incident.action === 'mirror_operator_message'
                          ? 'ID ответа VK'
                          : 'ID сообщения клиента'}
                      </dt>
                      <dd data-r-e2822c38="">{incident.clientMessageId}</dd>
                    </div>
                    {incident.action !== 'open_request' ? (
                      <div data-r-e2822c38="">
                        <dt data-r-e2822c38="">{'ID темы Telegram'}</dt>
                        <dd data-r-e2822c38="">{incident.operatorTopicId}</dd>
                      </div>
                    ) : null}
                    <div data-r-e2822c38="">
                      <dt data-r-e2822c38="">{'Операция'}</dt>
                      <dd data-r-e2822c38="">
                        {$unref(operationLabel)(incident)}
                      </dd>
                    </div>
                  </dl>
                </details>
                <OperatorRelayIncidentActions
                  incident={incident}
                  pendingActionId={$props.pendingActionId}
                  onResolve={(id, resolution) =>
                    $emit('resolve', id, resolution)
                  }
                  data-r-e2822c38=""
                />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}
