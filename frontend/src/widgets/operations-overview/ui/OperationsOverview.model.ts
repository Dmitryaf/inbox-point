import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';

import type { OperationsStatus } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  pendingDeliveryId: string | undefined;
  status: OperationsStatus;
} & EventProps<{
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
  return { $emit, observedAt };
}
