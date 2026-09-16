import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';

import type {
  OperationsStatus,
  OperatorActionResolution,
} from '@frontend/entities/operations/model/types';
import { formatShortDateTimeWithSeconds } from '@frontend/shared/lib/format-date-time';

export type ComponentProps = {
  pendingDeliveryId: string | undefined;
  pendingOperatorActionId: string | undefined;
  pendingInboundEventId: string | undefined;
  status: OperationsStatus;
  statusUnavailable?: boolean;
} & EventProps<{
  resolveDelivery: [
    deliveryId: string,
    resolution: 'not_received' | 'received',
  ];
  retryDelivery: [deliveryId: string];
  resolveOperatorAction: [
    actionId: string,
    resolution: OperatorActionResolution,
  ];
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
  const observedAt = computed(() =>
    formatShortDateTimeWithSeconds(props.status.observedAt),
  );
  const overallLabel = computed(() => {
    if (props.statusUnavailable) {
      return 'Состояние неизвестно';
    }
    if (props.status.state === 'healthy') {
      return 'Всё работает';
    }
    if (props.status.state === 'attention') {
      return 'Нужно проверить';
    }
    return props.status.outbound.mode === 'paused'
      ? 'Ответы клиентам приостановлены'
      : 'Приём обращений приостановлен';
  });
  const overallDescription = computed(() => {
    if (props.statusUnavailable) {
      return `Не удалось обновить состояние. Показаны последние данные от ${observedAt.value}.`;
    }
    if (props.status.state === 'healthy') {
      return 'Всё работает: каналы принимают сообщения, ответы отправляются.';
    }
    if (props.status.state === 'attention') {
      return 'Выше показано, что не работает и что нужно сделать.';
    }
    return props.status.outbound.mode === 'paused'
      ? 'Ответы сохраняются и будут отправлены после возобновления.'
      : 'Новые обращения временно не создаются, активные диалоги продолжаются.';
  });
  return { $emit, observedAt, overallLabel, overallDescription };
}
