import { type ComponentAttributes } from '@manage/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@manage/shared/lib/component-props';
import type { CustomSection } from '@manage/entities/content/model/types';

export type ComponentProps = {
  modelValue: CustomSection[];
  onModelValueChange?: (value: CustomSection[]) => void;
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
  const sections = $model<CustomSection[]>('modelValue', { required: true });
  function add(): void {
    if (sections.value.length < 6) {
      sections.value.push({ label: '', text: '' });
    }
  }
  return { sections, add };
}
