import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';

import type { OperationsStatus } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  deliveries: OperationsStatus['deliveries'];
  deliveryControlPending: 'pause' | 'resume' | undefined;
  outbound: OperationsStatus['outbound'];
  pendingDeliveryId: string | undefined;
} & EventProps<{
  changeDeliveryMode: [mode: 'pause' | 'resume'];
  retry: [deliveryId: string];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const state = computed(() => {
    if (props.deliveries.state === 'paused') {
      return { label: 'Доставка остановлена', tone: 'neutral' };
    }
    if (props.deliveries.state === 'failed') {
      return { label: 'Есть ошибки', tone: 'attention' };
    }
    if (props.deliveries.state === 'stalled') {
      return { label: 'Обработчик остановлен', tone: 'attention' };
    }
    if (props.deliveries.state === 'backlog') {
      return { label: 'Очередь задерживается', tone: 'attention' };
    }
    return { label: 'Работает', tone: 'healthy' };
  });
  function formatCreatedAt(value: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }
  return { $emit, state, formatCreatedAt };
}
