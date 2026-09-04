import { type ComponentAttributes } from '@manage/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@manage/shared/lib/component-props';
import type { ContentDraft } from '@manage/entities/content/model/types';

export type ComponentProps = {
  modelValue: ContentDraft;
  onModelValueChange?: (value: ContentDraft) => void;
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
  const draft = $model<ContentDraft>('modelValue', { required: true });
  return { draft };
}
