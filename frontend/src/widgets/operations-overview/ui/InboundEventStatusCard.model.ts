import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type { InboundEventOperationsStatus } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  inboundEvents: InboundEventOperationsStatus;
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
  function formatReceivedAt(value: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }
  return { $emit, formatReceivedAt };
}
