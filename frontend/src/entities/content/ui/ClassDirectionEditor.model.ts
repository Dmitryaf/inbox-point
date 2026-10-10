import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { computed, ref } from '@frontend/shared/lib/model-state';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { addClassGroup } from '@frontend/entities/content/model/class-editor';

export type ComponentProps = {
  directionId: string;
} & EventProps<{
  openTarget: [type: 'direction' | 'group', id: string];
  removed: [];
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
  const direction = computed(() =>
    draft.value.directions.find((item) => item.id === props.directionId),
  );
  const groups = computed(() =>
    draft.value.groups.filter((item) => item.directionId === props.directionId),
  );
  const notice = ref('');
  function add(): void {
    const id = addClassGroup(draft.value, props.directionId);
    if (id) {
      emit('openTarget', 'group', id);
    }
  }
  function remove(): void {
    if (groups.value.length) {
      notice.value =
        'Сначала перенесите группы в другое направление или удалите их.';
      return;
    }
    if (
      !window.confirm('Удалить направление и связанные с ним ключевые слова?')
    ) {
      return;
    }
    draft.value.directions = draft.value.directions.filter(
      (item) => item.id !== props.directionId,
    );
    draft.value.keywords = draft.value.keywords.filter(
      (item) =>
        item.targetType !== 'direction' || item.targetId !== props.directionId,
    );
    emit('removed');
  }
  return { draft, emit, direction, groups, notice, add, remove };
}
