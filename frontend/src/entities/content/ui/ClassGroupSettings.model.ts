import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import type {
  ClassGroup,
  ClassDirection,
} from '@core/application/class-content';

export type ComponentProps = {
  directions: ClassDirection[];
} & EventProps<{
  remove: [];
}> & {
    modelValue: ClassGroup;
    onModelValueChange?: (value: ClassGroup) => void;
  } & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
  $model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
) {
  const group = $model<ClassGroup>('modelValue', { required: true });
  return { $emit, group };
}
