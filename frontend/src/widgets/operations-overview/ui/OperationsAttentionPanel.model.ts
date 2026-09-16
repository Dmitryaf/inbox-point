import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import {
  channelProblem,
  type ChannelProblem,
  type OperationsAttentionEmits,
} from '@frontend/widgets/operations-overview/model/operations-attention';

export type ComponentProps = {
  pendingDeliveryId: string | undefined;
  pendingInboundEventId: string | undefined;
  pendingOperatorActionId: string | undefined;
  status: OperationsStatus;
} & EventProps<OperationsAttentionEmits> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const channelProblems = computed<ChannelProblem[]>(() =>
    [
      channelProblem('Telegram', props.status.channels.telegram),
      channelProblem('VK', props.status.channels.vk),
    ].filter((problem): problem is ChannelProblem => Boolean(problem)),
  );
  const deliveryStopped = computed(
    () =>
      props.status.deliveries.state === 'stalled' ||
      !props.status.deliveries.worker.running,
  );
  const setupProblems = computed(() =>
    channelProblems.value.filter((problem) => problem.kind === 'setup'),
  );
  const connectionProblems = computed(() =>
    channelProblems.value.filter((problem) => problem.kind === 'connection'),
  );
  const hasOperationalProblems = computed(
    () =>
      connectionProblems.value.length > 0 ||
      props.status.operatorInbox.state === 'attention' ||
      deliveryStopped.value ||
      props.status.deliveries.incidents.length > 0 ||
      props.status.operatorRelays.incidents.length > 0 ||
      props.status.inboundEvents.incidents.length > 0,
  );
  const hasAttention = computed(
    () => channelProblems.value.length > 0 || hasOperationalProblems.value,
  );
  return {
    $emit,
    deliveryStopped,
    setupProblems,
    connectionProblems,
    hasOperationalProblems,
    hasAttention,
  };
}
