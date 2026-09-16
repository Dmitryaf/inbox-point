import { renderOperatorRelayIncidentListPart1Layout5 } from './OperatorRelayIncidentList.part1.layout5';
import { renderOperatorRelayIncidentListPart1Layout4 } from './OperatorRelayIncidentList.part1.layout4';
import { renderOperatorRelayIncidentListPart1Layout3 } from './OperatorRelayIncidentList.part1.layout3';
import { renderOperatorRelayIncidentListPart1Layout2 } from './OperatorRelayIncidentList.part1.layout2';
import { renderOperatorRelayIncidentListPart1Layout1 } from './OperatorRelayIncidentList.part1.layout1';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';
import {
  actionButtonLabel,
  canUseWeb,
  isLifecycle,
  lifecycleResolutionLabel,
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
      {$props.incidents.length > 0
        ? renderOperatorRelayIncidentListPart1Layout2(
            {
              ...$attributes,
              'aria-labelledby': 'operator-relay-incidents-title',
              className: $class('delivery-incidents', $attributes.className),
              'data-r-e2822c38': '',
            },
            $renderList($props.incidents, (incident) =>
              renderOperatorRelayIncidentListPart1Layout1(
                { key: incident.id },
                $unref(isLifecycle)(incident)
                  ? 'Состояние темы требует решения'
                  : `Обращение из ${incident.channel} требует решения`,
                { dateTime: incident.createdAt },
                $unref(formatShortDateTime)(incident.createdAt),
                $unref(isLifecycle)(incident)
                  ? 'Не удалось точно определить, изменилось ли состояние темы.'
                  : 'Не удалось точно определить, появилось ли сообщение у операторов.',
                incident.requestId,
                incident.reason,
                incident.clientMessageId,
                incident.action !== 'open_request' ? (
                  <div data-r-e2822c38="">
                    <dt data-r-e2822c38="">{'ID темы Telegram'}</dt>
                    <dd data-r-e2822c38="">{incident.operatorTopicId}</dd>
                  </div>
                ) : null,
                $unref(operationLabel)(incident),
                incident.action === 'relay_message' ? (
                  <p data-r-e2822c38="">
                    {' Проверьте Telegram-тему перед выбором действия. '}
                  </p>
                ) : null,
                incident.action === 'relay_message' && !incident.confirmable ? (
                  <p data-r-e2822c38="">
                    {
                      ' Не все сообщения появились в Telegram. Откройте обращение здесь. '
                    }
                  </p>
                ) : null,
                incident.action === 'relay_message' && incident.confirmable
                  ? renderOperatorRelayIncidentListPart1Layout4(
                      {
                        disabled: Boolean($props.pendingActionId),
                        onClick: () =>
                          void $emit('resolve', incident.id, 'received'),
                      },
                      $unref(actionButtonLabel)(
                        $props.pendingActionId === incident.id,
                        'Сообщение есть в Telegram',
                      ),
                    )
                  : null,
                $unref(isLifecycle)(incident)
                  ? renderOperatorRelayIncidentListPart1Layout5(
                      {
                        disabled: Boolean($props.pendingActionId),
                        onClick: () =>
                          void $emit('resolve', incident.id, 'completed'),
                      },
                      $unref(actionButtonLabel)(
                        $props.pendingActionId === incident.id,
                        $unref(lifecycleResolutionLabel)(incident, 'completed'),
                      ),
                    )
                  : null,
                $unref(isLifecycle)(incident)
                  ? renderOperatorRelayIncidentListPart1Layout3(
                      {
                        disabled: Boolean($props.pendingActionId),
                        onClick: () =>
                          void $emit('resolve', incident.id, 'not_completed'),
                      },
                      $unref(actionButtonLabel)(
                        $props.pendingActionId === incident.id,
                        $unref(lifecycleResolutionLabel)(
                          incident,
                          'not_completed',
                        ),
                      ),
                    )
                  : null,
                $unref(canUseWeb)(incident) ? (
                  <button
                    type="button"
                    disabled={Boolean($props.pendingActionId)}
                    onClick={() =>
                      void $emit('resolve', incident.id, 'use_web')
                    }
                    data-r-e2822c38=""
                  >
                    {$unref(actionButtonLabel)(
                      $props.pendingActionId === incident.id,
                      'Открыть обращение здесь',
                    )}
                  </button>
                ) : null,
              ),
            ),
          )
        : null}
    </>
  );
}
