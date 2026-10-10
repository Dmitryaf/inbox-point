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
import { removeClassGroup } from '@frontend/entities/content/model/class-editor';

export type ComponentProps = {
  groupId: string;
} & EventProps<{
  openTarget: [type: 'direction' | 'group', id: string];
  removed: [];
  preview: [action: string];
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
  const group = computed(() =>
    draft.value.groups.find((item) => item.id === props.groupId),
  );
  const schedule = computed({
    get: () => group.value?.meetings.join('\n') ?? '',
    set: (value: string) => {
      if (group.value) {
        group.value.meetings = value.split(/\r?\n/u);
      }
    },
  });
  function remove(): void {
    if (
      !window.confirm(
        'Удалить группу и её ключевые слова? Уже отправленные заявки сохранятся.',
      )
    ) {
      return;
    }
    removeClassGroup(draft.value, props.groupId);
    emit('removed');
  }
  return { draft, emit, group, schedule, remove };
}
