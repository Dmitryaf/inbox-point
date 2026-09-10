import '@frontend/features/control-outbound-delivery/styles/outbound-delivery-control.react-data-r-add5063d.css';
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
        className={$class('outbound-delivery-control', $attributes.className)}
        data-r-add5063d=""
      >
        <div data-r-add5063d="">
          {$props.outbound.mode === 'paused' ? (
            <p data-r-add5063d="">
              {
                ' Ответы не отправляются. Новые ответы сохраняются до возобновления. '
              }
            </p>
          ) : (
            <p data-r-add5063d="">{'Ответы отправляются автоматически.'}</p>
          )}
        </div>
        {renderOutboundDeliveryControlPart1($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
