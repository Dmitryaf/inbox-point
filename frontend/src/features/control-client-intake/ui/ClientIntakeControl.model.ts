import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { useClientIntakeControl } from '@frontend/features/control-client-intake/model/use-client-intake-control';

export type ComponentProps = EventProps<{
  changed: [];
  unauthorized: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
  _model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
  $expose: (value: Record<string, unknown>) => void,
) {
  const emit = $emit;
  const control = useClientIntakeControl({
    onChanged: () => emit('changed'),
    onUnauthorized: () => emit('unauthorized'),
  });
  $expose({ refresh: control.load });
  return { control };
}
