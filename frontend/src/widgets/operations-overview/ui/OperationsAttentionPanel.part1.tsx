import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import DeliveryIncidentList from './DeliveryIncidentList';
import InboundEventIncidentList from './InboundEventIncidentList';
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
          className={$class('attention-panel card', $attributes.className)}
          data-r-a910a991=""
        >
          <header className="attention-panel-heading" data-r-a910a991="">
            <p className="eyebrow" data-r-a910a991="">
              {'Сначала проверьте это'}
            </p>
            <h2 id="attention-title" data-r-a910a991="">
              {'Требует внимания'}
            </h2>
            <p data-r-a910a991="">
              {'Здесь собраны только проблемы, для которых нужно ваше решение.'}
            </p>
          </header>
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
