import { renderDeliveryIncidentListPart1Layout1 } from './DeliveryIncidentList.part1.layout1';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';

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
  const { $emit } = $state;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {$props.incidents.length > 0 ? (
        <section
          {...$attributes}
          aria-labelledby="delivery-incidents-title"
          className={$class('delivery-incidents', $attributes.className)}
          data-r-d17d69f5=""
        >
          <h3 id="delivery-incidents-title" data-r-d17d69f5="">
            {'Ответы клиентам'}
          </h3>
          <p data-r-d17d69f5="">
            {'Эти ответы не дошли или требуют ручной проверки.'}
          </p>
          <ol data-r-d17d69f5="">
            {$renderList($props.incidents, (incident) =>
              renderDeliveryIncidentListPart1Layout1(
                { key: incident.id },
                incident.retryAllowed
                  ? `Ответ в ${incident.channel} не доставлен`
                  : `Доставку в ${incident.channel} нужно проверить`,
                { dateTime: incident.createdAt },
                $unref(formatShortDateTime)(incident.createdAt),
                incident.retryAllowed ? (
                  <p data-r-d17d69f5="">
                    {
                      ' Ответ не дошёл до клиента. Попробуйте отправить его ещё раз. '
                    }
                  </p>
                ) : (
                  <p data-r-d17d69f5="">
                    {
                      ' Не удалось узнать, получил ли клиент ответ. Сначала проверьте переписку, затем выберите подходящее действие. '
                    }
                  </p>
                ),
                $or(incident.displayName, () => 'Имя не указано'),
                incident.channel,
                incident.messageText ?? 'Текст ответа недоступен',
                incident.requestId,
                incident.operatorTopicId,
                incident.operatorMessageId ? (
                  <div data-r-d17d69f5="">
                    <dt data-r-d17d69f5="">{'ID сообщения'}</dt>
                    <dd data-r-d17d69f5="">{incident.operatorMessageId}</dd>
                  </div>
                ) : null,
                incident.reason,
                incident.retryAllowed ? (
                  <button
                    type="button"
                    disabled={Boolean($props.pendingDeliveryId)}
                    onClick={() => void $emit('retry', incident.id)}
                    data-r-d17d69f5=""
                  >
                    {$props.pendingDeliveryId === incident.id
                      ? 'Начинаем отправку…'
                      : 'Повторить отправку'}
                  </button>
                ) : (
                  <div
                    className="delivery-resolution-actions"
                    data-r-d17d69f5=""
                  >
                    <p data-r-d17d69f5="">
                      {'Сначала проверьте, было ли получено сообщение.'}
                    </p>
                    <button
                      type="button"
                      disabled={Boolean($props.pendingDeliveryId)}
                      onClick={() =>
                        void $emit('resolve', incident.id, 'received')
                      }
                      className="secondary-button"
                      data-r-d17d69f5=""
                    >
                      {$props.pendingDeliveryId === incident.id
                        ? 'Сохраняем…'
                        : 'Сообщение получено'}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean($props.pendingDeliveryId)}
                      onClick={() =>
                        void $emit('resolve', incident.id, 'not_received')
                      }
                      data-r-d17d69f5=""
                    >
                      {$props.pendingDeliveryId === incident.id
                        ? 'Сохраняем…'
                        : 'Не получено — повторить'}
                    </button>
                  </div>
                ),
              ),
            )}
          </ol>
        </section>
      ) : null}
    </>
  );
}
