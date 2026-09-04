import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import type { FaqItem } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  modelValue: FaqItem[];
  onModelValueChange?: (value: FaqItem[]) => void;
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
  const items = $model<FaqItem[]>('modelValue', { required: true });
  function add(): void {
    if (items.value.length < 20) {
      items.value.push({ answer: '', question: '' });
    }
  }
  return { items, add };
}
