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
import { normalizeKeyword, groupTitle } from '@core/application/class-content';
import type { ClassKeyword } from '@core/application/class-content';
import type { ContentDraft } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  targetType: 'group';
  targetId: string;
} & EventProps<{
  openTarget: [type: 'direction' | 'group', id: string];
}> & {
    modelValue: ContentDraft;
    onModelValueChange?: (value: ContentDraft) => void;
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
  const draft = $model<ContentDraft>('modelValue', { required: true });
  const props = $props;
  const emit = $emit;
  const words = computed(() =>
    draft.value.keywords.filter(
      (item) =>
        item.targetType === props.targetType &&
        item.targetId === props.targetId,
    ),
  );
  const directionWords = computed(() => {
    const group = draft.value.groups.find((item) => item.id === props.targetId);
    return draft.value.keywords.filter(
      (item) =>
        item.targetType === 'direction' && item.targetId === group?.directionId,
    );
  });
  function moveToGroup(word: ClassKeyword): void {
    word.targetType = 'group';
    word.targetId = props.targetId;
  }
  function conflict(word: ClassKeyword): ClassKeyword | undefined {
    return draft.value.keywords.find(
      (item) =>
        item !== word &&
        normalizeKeyword(item.phrase) === normalizeKeyword(word.phrase) &&
        Boolean(word.phrase.trim()),
    );
  }
  function targetLabel(word: ClassKeyword): string {
    const group = draft.value.groups.find((item) => item.id === word.targetId);
    return word.targetType === 'group' && group
      ? groupTitle(draft.value, group)
      : (draft.value.directions.find((item) => item.id === word.targetId)
          ?.name ?? '');
  }
  function remove(word: ClassKeyword): void {
    draft.value.keywords = draft.value.keywords.filter((item) => item !== word);
  }
  return {
    draft,
    emit,
    words,
    directionWords,
    moveToGroup,
    conflict,
    targetLabel,
    remove,
  };
}
