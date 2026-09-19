import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { computed } from '@frontend/shared/lib/model-state';
import type { ContentDraft } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  errors: Readonly<Record<string, string | undefined>>;
  index: number;
} & {
  modelValue: ContentDraft;
  onModelValueChange?: (value: ContentDraft) => void;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  _emit: (event: string, ...args: unknown[]) => void,
  $model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
) {
  const draft = $model<ContentDraft>('modelValue', { required: true });
  const props = $props;
  const item = computed(() => draft.value.schedule[props.index]!);
  function move(offset: -1 | 1): void {
    const target = props.index + offset;
    if (target < 0 || target >= draft.value.schedule.length) {
      return;
    }
    const [moved] = draft.value.schedule.splice(props.index, 1);
    if (moved) {
      draft.value.schedule.splice(target, 0, moved);
    }
  }
  return { draft, item, move };
}
