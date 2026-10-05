import { templateRef as $templateRef } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl';
import OutboundDeliveryControl from '@frontend/features/control-outbound-delivery/ui/OutboundDeliveryControl';

import type { ModelScope } from '@frontend/shared/lib/model-state';
import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './MessageFlowControl.model';
export function renderMessageFlowControlPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
  $scope: ModelScope,
) {
  const { $emit } = $state;

  return (
    <>
      <div className="message-flow-body" data-r-c8d03842="">
        <ClientIntakeControl
          channels={$props.channels}
          onChanged={() => void $unref($state.emit)('changed')}
          onUnauthorized={() => void $unref($state.emit)('unauthorized')}
          ref={$templateRef($state, 'intakeControl', $scope)}
          data-r-c8d03842=""
        />
        <section
          aria-labelledby="outbound-flow-title"
          className="message-flow-outbound"
          data-r-c8d03842=""
        >
          <h3 id="outbound-flow-title" data-r-c8d03842="">
            {'Ответы клиентам'}
          </h3>
          <OutboundDeliveryControl
            outbound={$props.outbound}
            pending={$props.outboundPending}
            onChange={($event) => void $emit('changeDeliveryMode', $event)}
            data-r-c8d03842=""
          />
        </section>
      </div>
    </>
  );
}
