import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { computed, ref, nextTick } from '@frontend/shared/lib/model-state';
import type { ContentDraft } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  modelValue: ContentDraft;
  onModelValueChange?: (value: ContentDraft) => void;
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
  const draft = $model<ContentDraft>('modelValue', { required: true });
  const directionId = ref('');
  const groupId = ref('');
  const reviewing = ref(false);
  const direction = computed(() =>
    draft.value.directions.find((item) => item.id === directionId.value),
  );
  const group = computed(() =>
    draft.value.groups.find((item) => item.id === groupId.value),
  );
  async function open(
    targetType: 'direction' | 'group',
    targetId: string,
  ): Promise<void> {
    groupId.value = targetType === 'group' ? targetId : '';
    directionId.value =
      targetType === 'direction'
        ? targetId
        : (draft.value.groups.find((item) => item.id === targetId)
            ?.directionId ?? '');
    await nextTick();
    document.getElementById('class-directions')?.focus();
  }
  function back(): void {
    if (group.value) {
      groupId.value = '';
    } else {
      directionId.value = '';
      reviewing.value = false;
    }
  }
  return {
    draft,
    directionId,
    groupId,
    reviewing,
    direction,
    group,
    open,
    back,
  };
}
