import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderOutboundDeliveryControlPart1 } from './OutboundDeliveryControl.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OutboundDeliveryControl.model';

export default function OutboundDeliveryControl(
  $incomingProps: ComponentProps,
) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        className={$class('outbound-emergency-control', $attributes.className)}
      >
        <div>
          <strong>{'Аварийная остановка'}</strong>
          {$props.outbound.mode === 'paused' ? (
            <p>
              {
                ' Доставка ответов остановлена. Новые ответы сохраняются в очереди. '
              }
            </p>
          ) : (
            <p>
              {
                ' Исходящая доставка включена; очередь обрабатывается автоматически. '
              }
            </p>
          )}
        </div>
        {renderOutboundDeliveryControlPart1($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
