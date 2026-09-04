import { type ComponentAttributes } from '@manage/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@manage/shared/lib/component-props';
import type { FaqItem } from '@manage/entities/content/model/types';

export type ComponentProps = {
  modelValue: FaqItem[];
  onModelValueChange?: (value: FaqItem[]) => void;
} & ComponentAttributes;
export const componentDefaults = {};
export function createComponentModel(
  $props: ComponentProps,
  $emit: (event: string, ...args: unknown[]) => void,
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
