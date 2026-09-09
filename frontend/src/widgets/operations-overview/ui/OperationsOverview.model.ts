import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';

import type { OperationsStatus } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  deliveryControlPending: 'pause' | 'resume' | undefined;
  pendingDeliveryId: string | undefined;
  status: OperationsStatus;
} & EventProps<{
  changeDeliveryMode: [mode: 'pause' | 'resume'];
  resolveDelivery: [
    deliveryId: string,
    resolution: 'not_received' | 'received',
  ];
  retryDelivery: [deliveryId: string];
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
    new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(props.status.observedAt)),
  );
  const overallLabel = computed(() => {
    if (props.status.state === 'healthy') {
      return 'Сервис работает';
    }
    if (props.status.state === 'attention') {
      return 'Нужно проверить';
    }
    return props.status.outbound.mode === 'paused'
      ? 'Доставка ответов остановлена'
      : 'Приём обращений приостановлен';
  });
  const overallDescription = computed(() => {
    if (props.status.state === 'healthy') {
      return 'Всё работает: каналы принимают сообщения, ответы отправляются.';
    }
    if (props.status.state === 'attention') {
      return 'Один из разделов требует внимания. Подробности отмечены ниже.';
    }
    return props.status.outbound.mode === 'paused'
      ? 'Ответы сохраняются в очереди и будут отправлены после возобновления.'
      : 'Новые обращения временно не создаются, активные диалоги продолжаются.';
  });
  return { $emit, observedAt, overallLabel, overallDescription };
}
