import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import type {
  ChannelOperationsStatus,
  OperationsStatus,
} from '@frontend/entities/operations/model/types';

interface ChannelProblem {
  action: string;
  name: string;
  summary: string;
}
export type ComponentProps = {
  pendingDeliveryId: string | undefined;
  pendingInboundEventId: string | undefined;
  pendingOperatorActionId: string | undefined;
  status: OperationsStatus;
} & EventProps<{
  resolveDelivery: [
    deliveryId: string,
    resolution: 'not_received' | 'received',
  ];
  retryDelivery: [deliveryId: string];
  resolveOperatorAction: [actionId: string, resolution: 'received' | 'use_web'];
  resolveInboundEvent: [
    eventId: string,
    source: string,
    resolution: 'retry' | 'skip',
  ];
}> &
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
  const hasAttention = computed(
    () =>
      channelProblems.value.length > 0 ||
      deliveryStopped.value ||
      props.status.deliveries.incidents.length > 0 ||
      props.status.operatorRelays.incidents.length > 0 ||
      props.status.inboundEvents.incidents.length > 0,
  );
  function channelProblem(
    name: string,
    channel: ChannelOperationsStatus,
  ): ChannelProblem | undefined {
    if (channel.state === 'running' || channel.state === 'starting') {
      return undefined;
    }
    if (channel.state === 'not_configured') {
      return {
        action: 'Откройте раздел «Каналы» и завершите подключение.',
        name: `${name} не подключён`,
        summary: 'Сообщения из этого канала сейчас не принимаются.',
      };
    }
    return {
      action:
        'Обновите состояние. Если связь не восстановилась, проверьте подключение канала.',
      name: `Нет связи с ${name}`,
      summary: 'Новые сообщения из этого канала могут не поступать.',
    };
  }
  return { $emit, channelProblems, deliveryStopped, hasAttention };
}
