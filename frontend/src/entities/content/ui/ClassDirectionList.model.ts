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
import type { ContentDraft } from '@frontend/entities/content/model/types';

export type ComponentProps = EventProps<{
  openTarget: [type: 'direction' | 'group', id: string];
}> & {
  modelValue: ContentDraft;
  onModelValueChange?: (value: ContentDraft) => void;
  reviewing: boolean;
  onReviewingChange?: (value: boolean) => void;
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
  const draft = $model<ContentDraft>('modelValue', { required: true });
  const reviewing = $model<boolean>('reviewing', { required: true });
  const emit = $emit;
  const pending = computed(() =>
    draft.value.groups.filter((group) => group.review),
  );
  return { draft, reviewing, emit, pending };
}
