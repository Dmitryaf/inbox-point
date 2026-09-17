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
} from './InboundEventIncidentList.model';
export function renderInboundEventIncidentListPart1(
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
          aria-labelledby="inbound-event-incidents-title"
          className={$class('delivery-incidents', $attributes.className)}
          data-r-4b17d194=""
        >
          <h3 id="inbound-event-incidents-title" data-r-4b17d194="">
            {'Необработанные сообщения'}
          </h3>
          <p data-r-4b17d194="">
            {
              ' Некоторые входящие события не удалось обработать автоматически. Проверьте сведения и выберите подходящее действие. '
            }
          </p>
          <ol data-r-4b17d194="">
            {$renderList($props.incidents, (incident) => (
              <li key={incident.eventId} data-r-4b17d194="">
                <div className="delivery-incident-heading" data-r-4b17d194="">
                  <strong data-r-4b17d194="">
                    {'Сообщение '}
                    {incident.channel}
                    {' требует решения'}
                  </strong>
                  <time dateTime={incident.receivedAt} data-r-4b17d194="">
                    {$unref(formatShortDateTime)(incident.receivedAt)}
                  </time>
                </div>
                {incident.channel === 'Telegram' ? (
                  <p data-r-4b17d194="">
                    {
                      ' Перед повтором проверьте чат: предыдущий ответ бота мог быть отправлен. Если он уже есть, пропустите событие. '
                    }
                  </p>
                ) : (
                  <p data-r-4b17d194="">
                    {
                      ' После повторной обработки сообщение может появиться у администратора. Если событие точно не нужно, его можно пропустить. '
                    }
                  </p>
                )}
                <details className="technical-details" data-r-4b17d194="">
                  <summary data-r-4b17d194="">{'Технические данные'}</summary>
                  <dl className="delivery-incident-context" data-r-4b17d194="">
                    <div data-r-4b17d194="">
                      <dt data-r-4b17d194="">{'ID события'}</dt>
                      <dd data-r-4b17d194="">{incident.eventId}</dd>
                    </div>
                    <div data-r-4b17d194="">
                      <dt data-r-4b17d194="">{'Попыток обработки'}</dt>
                      <dd data-r-4b17d194="">{incident.attempts}</dd>
                    </div>
                    <div data-r-4b17d194="">
                      <dt data-r-4b17d194="">{'Источник'}</dt>
                      <dd data-r-4b17d194="">{incident.source}</dd>
                    </div>
                    <div data-r-4b17d194="">
                      <dt data-r-4b17d194="">{'Причина'}</dt>
                      <dd data-r-4b17d194="">{incident.reason}</dd>
                    </div>
                  </dl>
                </details>
                <div className="delivery-resolution-actions" data-r-4b17d194="">
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
                    data-r-4b17d194=""
                  >
                    {$props.pendingEventId === incident.eventId
                      ? 'Повторяем…'
                      : 'Повторить обработку'}
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
                    className="quiet-danger"
                    data-r-4b17d194=""
                  >
                    {$props.pendingEventId === incident.eventId
                      ? 'Сохраняем…'
                      : 'Пропустить событие'}
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
