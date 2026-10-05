import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import ConnectionSetupGuide from './ConnectionSetupGuide';
import DeliveryIncidentList from './DeliveryIncidentList';
import InboundEventIncidentList from './InboundEventIncidentList';
import OperatorInboxAttention from './OperatorInboxAttention';
import OperatorRelayIncidentList from './OperatorRelayIncidentList';

import { renderOperationsAttentionPanelPart2 } from './OperationsAttentionPanel.part2';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperationsAttentionPanel.model';
export function renderOperationsAttentionPanelPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;
  const hasOperationalProblems = $state.hasOperationalProblems.value;
  const setupProblems = $state.setupProblems.value;
  const deliveryStopped = $state.deliveryStopped.value;
  const hasAttention = $state.hasAttention.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {hasAttention ? (
        <section
          {...$attributes}
          aria-labelledby="attention-title"
          aria-live="polite"
          className={$class(
            'attention-panel card',
            { 'attention-panel--setup-only': !hasOperationalProblems },
            $attributes.className,
          )}
          data-r-a910a991=""
        >
          <header className="attention-panel-heading" data-r-a910a991="">
            <p className="eyebrow" data-r-a910a991="">
              {hasOperationalProblems
                ? 'Сначала проверьте это'
                : 'Первый запуск'}
            </p>
            <h2 id="attention-title" data-r-a910a991="">
              {hasOperationalProblems
                ? 'Требует внимания'
                : 'Закончите подключение'}
            </h2>
            <p data-r-a910a991="">
              {hasOperationalProblems
                ? 'Здесь собраны только проблемы, для которых нужно ваше решение.'
                : 'Сначала подключите Telegram: сотрудники будут отвечать в группе. Затем можно подключить VK для клиентов.'}
            </p>
          </header>
          {setupProblems.length ? (
            <ConnectionSetupGuide problems={setupProblems} data-r-a910a991="" />
          ) : null}
          {renderOperationsAttentionPanelPart2($state)}
          {deliveryStopped ? (
            <div className="attention-list" data-r-a910a991="">
              <article data-r-a910a991="">
                <h3 data-r-a910a991="">{'Ответы сейчас не отправляются'}</h3>
                <p data-r-a910a991="">
                  {'Сохранённые ответы останутся в системе.'}
                </p>
                <p data-r-a910a991="">
                  {
                    ' Обновите страницу. Если отправка не началась, обратитесь к тому, кто установил приложение. '
                  }
                </p>
              </article>
            </div>
          ) : null}
          {$props.status.operatorInbox.state === 'attention' ? (
            <OperatorInboxAttention
              recoverableRequests={
                $props.status.operatorInbox.recoverableWebRequests
              }
              data-r-a910a991=""
            />
          ) : null}
          <DeliveryIncidentList
            incidents={$props.status.deliveries.incidents}
            pendingDeliveryId={$props.pendingDeliveryId}
            onResolve={(id, resolution) =>
              $emit('resolveDelivery', id, resolution)
            }
            onRetry={($event) => void $emit('retryDelivery', $event)}
            data-r-a910a991=""
          />
          <OperatorRelayIncidentList
            incidents={$props.status.operatorRelays.incidents}
            pendingActionId={$props.pendingOperatorActionId}
            onResolve={(id, resolution) =>
              $emit('resolveOperatorAction', id, resolution)
            }
            data-r-a910a991=""
          />
          <InboundEventIncidentList
            incidents={$props.status.inboundEvents.incidents}
            pendingEventId={$props.pendingInboundEventId}
            onResolve={(id, source, resolution) =>
              $emit('resolveInboundEvent', id, source, resolution)
            }
            data-r-a910a991=""
          />
        </section>
      ) : null}
    </>
  );
}
