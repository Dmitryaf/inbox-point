import { renderOperatorRelayIncidentListPart1Layout1 } from './OperatorRelayIncidentList.part1.layout1';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';
import {
  isLifecycle,
  operationLabel,
} from '@frontend/widgets/operations-overview/model/operator-action-presentation';

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
            {$renderList($props.incidents, (incident) =>
              renderOperatorRelayIncidentListPart1Layout1(
                { key: incident.id },
                $unref(isLifecycle)(incident)
                  ? 'Состояние темы требует решения'
                  : `Обращение из ${incident.channel} требует решения`,
                { dateTime: incident.createdAt },
                $unref(formatShortDateTime)(incident.createdAt),
                incident.heldReplyCount > 0 ? (
                  <p data-r-e2822c38="">{incident.reason}</p>
                ) : (
                  <p data-r-e2822c38="">
                    {$unref(isLifecycle)(incident)
                      ? 'Не удалось точно определить, изменилось ли состояние темы.'
                      : 'Не удалось точно определить, появилось ли сообщение у администраторов.'}
                  </p>
                ),
                incident.heldReplyCount > 1 ? (
                  <p data-r-e2822c38="">
                    {' Сохранено ответов: '}
                    {incident.heldReplyCount}
                    {'. Они будут отправлены по порядку. '}
                  </p>
                ) : null,
                $or(incident.displayName, () => 'Имя не указано'),
                incident.channel,
                !$unref(isLifecycle)(incident) ? (
                  <div className="incident-message" data-r-e2822c38="">
                    <strong data-r-e2822c38="">
                      {incident.action === 'mirror_operator_message'
                        ? 'Исходный ответ из VK'
                        : 'Исходное сообщение клиента'}
                    </strong>
                    <p data-r-e2822c38="">
                      {incident.messageText ?? 'Текст сообщения недоступен'}
                    </p>
                    <small data-r-e2822c38="">
                      {' Проверяется часть '}
                      {incident.sequence + 1}
                      {' сообщения. '}
                    </small>
                  </div>
                ) : null,
                incident.requestId,
                incident.reason,
                incident.action === 'mirror_operator_message'
                  ? 'ID ответа VK'
                  : 'ID сообщения клиента',
                incident.clientMessageId,
                incident.action !== 'open_request' ? (
                  <div data-r-e2822c38="">
                    <dt data-r-e2822c38="">{'ID темы Telegram'}</dt>
                    <dd data-r-e2822c38="">{incident.operatorTopicId}</dd>
                  </div>
                ) : null,
                $unref(operationLabel)(incident),
                {
                  incident: incident,
                  pendingActionId: $props.pendingActionId,
                  onResolve: (id, resolution) =>
                    $emit('resolve', id, resolution),
                },
              ),
            )}
          </ol>
        </section>
      ) : null}
    </>
  );
}
