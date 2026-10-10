import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { computed } from '@frontend/shared/lib/model-state';
import type { ClassGroup } from '@core/application/class-content';
import { duplicateClassGroup } from '@frontend/entities/content/model/class-enrollment';

export type ComponentProps = {
  groups: ClassGroup[];
} & EventProps<{
  openGroup: [id: string];
}> & {
    modelValue: ClassGroup;
    onModelValueChange?: (value: ClassGroup) => void;
  } & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
  $model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
) {
  const group = $model<ClassGroup>('modelValue', { required: true });
  const props = $props;
  const emit = $emit;
  const duplicate = computed(() =>
    duplicateClassGroup(props.groups, group.value),
  );
  return { group, emit, duplicate };
}
