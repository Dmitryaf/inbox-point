import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type { InboundEventIncident } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  incidents: readonly InboundEventIncident[];
  pendingEventId: string | undefined;
} & EventProps<{
  resolve: [eventId: string, source: string, resolution: 'retry' | 'skip'];
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
