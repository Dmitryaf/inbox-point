import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type { DeliveryIncident } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  incidents: readonly DeliveryIncident[];
  pendingDeliveryId: string | undefined;
} & EventProps<{
  resolve: [deliveryId: string, resolution: 'not_received' | 'received'];
  retry: [deliveryId: string];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  return { $emit };
}
