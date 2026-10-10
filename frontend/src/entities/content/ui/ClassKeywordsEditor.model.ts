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
  const targets = computed(() => [
    ...draft.value.directions.map((item) => ({
      value: `direction:${item.id}`,
      label: `Направление ${item.name}`,
    })),
    ...draft.value.groups.map((item) => ({
      value: `group:${item.id}`,
      label: `${draft.value.directions.find((direction) => direction.id === item.directionId)?.name ?? ''} → ${item.name}`,
    })),
  ]);
  function change(index: number, event: Event): void {
    const [targetType, targetId] = (
      event.target as HTMLSelectElement
    ).value.split(':');
    const keyword = draft.value.keywords[index];
    if (
      keyword &&
      targetId &&
      (targetType === 'direction' || targetType === 'group')
    ) {
      keyword.targetType = targetType;
      keyword.targetId = targetId;
    }
  }
  function add(): void {
    const target = draft.value.groups[0] ?? draft.value.directions[0];
    if (target) {
      draft.value.keywords.push({
        phrase: '',
        targetType: draft.value.groups.length ? 'group' : 'direction',
        targetId: target.id,
      });
    }
  }
  return { draft, targets, change, add };
}
