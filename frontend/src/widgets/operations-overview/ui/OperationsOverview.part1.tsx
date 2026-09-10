import OperationsAttentionPanel from './OperationsAttentionPanel';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperationsOverview.model';
export function renderOperationsOverviewPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      <OperationsAttentionPanel
        pendingDeliveryId={$props.pendingDeliveryId}
        pendingInboundEventId={$props.pendingInboundEventId}
        pendingOperatorActionId={$props.pendingOperatorActionId}
        status={$props.status}
        onResolveDelivery={(id, resolution) =>
          $emit('resolveDelivery', id, resolution)
        }
        onRetryDelivery={($event) => void $emit('retryDelivery', $event)}
        onResolveOperatorAction={(id, resolution) =>
          $emit('resolveOperatorAction', id, resolution)
        }
        onResolveInboundEvent={(id, source, resolution) =>
          $emit('resolveInboundEvent', id, source, resolution)
        }
        data-r-2dc401be=""
      />
    </>
  );
}
