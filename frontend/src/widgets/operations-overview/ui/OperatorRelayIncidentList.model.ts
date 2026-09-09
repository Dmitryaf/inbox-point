import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type { OperatorRelayIncident } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  incidents: readonly OperatorRelayIncident[];
  pendingActionId: string | undefined;
} & EventProps<{
  resolve: [actionId: string, resolution: 'received' | 'use_web'];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  function formatCreatedAt(value: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }
  return { $emit, formatCreatedAt };
}
