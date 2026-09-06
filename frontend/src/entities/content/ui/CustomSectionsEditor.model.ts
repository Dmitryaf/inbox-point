import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import type { CustomSection } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  modelValue: CustomSection[];
  onModelValueChange?: (value: CustomSection[]) => void;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  _emit: (event: string, ...args: unknown[]) => void,
  $model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
) {
  const sections = $model<CustomSection[]>('modelValue', {
    required: true,
  });
  function add(): void {
    if (sections.value.length < 6) {
      sections.value.push({ label: '', text: '' });
    }
  }
  return { sections, add };
}
