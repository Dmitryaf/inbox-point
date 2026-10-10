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
  const directionName = ref('');
  const notice = ref('');
  function add(): void {
    const name = directionName.value.trim();
    if (
      !name ||
      /[/:\r\n]/u.test(name) ||
      draft.value.directions.some(
        (item) =>
          item.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'),
      )
    ) {
      notice.value = 'Введите новое название направления, без / и :.';
      return;
    }
    draft.value.directions.push({ id: crypto.randomUUID(), name });
    directionName.value = '';
    notice.value = '';
  }
  return { draft, directionName, notice, add };
}
