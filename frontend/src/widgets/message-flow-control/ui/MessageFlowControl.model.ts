import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { useTemplateRef } from '@frontend/shared/lib/model-state';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  outbound: OperationsStatus['outbound'];
  outboundPending: 'pause' | 'resume' | undefined;
} & EventProps<{
  changed: [];
  changeDeliveryMode: [mode: 'pause' | 'resume'];
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
  const intakeControl = useTemplateRef<{
    refresh: () => Promise<string>;
  }>('intakeControl');
  $expose({
    refresh: () => intakeControl.value?.refresh() ?? Promise.resolve(''),
  });
  return { $emit, emit, intakeControl };
}
