import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type { ServiceControlScope } from '@frontend/entities/service-control/api/service-control-api';
import { useClientIntakeControl } from '@frontend/features/control-client-intake/model/use-client-intake-control';

export type ComponentProps = { scope?: ServiceControlScope } & EventProps<{
  changed: [];
  unauthorized: [];
}> &
  ComponentAttributes;
export const componentDefaults = {
  scope: 'manage',
};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const emit = $emit;
  const control = useClientIntakeControl({
    onChanged: () => emit('changed'),
    onUnauthorized: () => emit('unauthorized'),
    scope: props.scope,
  });
  return { control };
}
