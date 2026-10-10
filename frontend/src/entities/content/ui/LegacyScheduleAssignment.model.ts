import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { ref } from '@frontend/shared/lib/model-state';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { transferScheduleItem } from '@frontend/entities/content/model/class-editor';

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
  const index = ref(0);
  const directionId = ref('');
  const notice = ref('');
  function transfer(): void {
    const moved = transferScheduleItem(
      draft.value,
      index.value,
      directionId.value,
    );
    notice.value = moved
      ? 'Карточка перенесена в группу. Проверьте её и откройте набор при необходимости. Сохраните изменения.'
      : 'Выберите карточку и направление. Заполните название (до 80 символов, без / и :) и время. В направлении не должно быть группы с таким же названием.';
    index.value = 0;
  }
  return { draft, index, directionId, notice, transfer };
}
