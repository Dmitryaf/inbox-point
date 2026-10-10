import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { ref } from '@frontend/shared/lib/model-state';
import { normalizeKeyword } from '@core/application/class-content';
import type { ContentDraft } from '@frontend/entities/content/model/types';

export type ComponentProps = EventProps<{
  created: [id: string];
}> & {
  modelValue: ContentDraft;
  onModelValueChange?: (value: ContentDraft) => void;
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
  const emit = $emit;
  const adding = ref(false);
  const directionName = ref('');
  const notice = ref('');
  function add(): void {
    const name = directionName.value.trim();
    if (
      !name ||
      /[/:\r\n]/u.test(name) ||
      draft.value.directions.some(
        (item) => normalizeKeyword(item.name) === normalizeKeyword(name),
      )
    ) {
      notice.value = 'Введите новое название направления, без / и :.';
      return;
    }
    const id = crypto.randomUUID();
    draft.value.directions.push({ id, name });
    directionName.value = '';
    notice.value = '';
    adding.value = false;
    emit('created', id);
  }
  return { draft, adding, directionName, notice, add };
}
