import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { computed } from '@frontend/shared/lib/model-state';
import {
  formatFaqResponse,
  normalizeFaqItems,
} from '@frontend/entities/content/lib/client-response-preview';
import type { ContentDraft } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  errors?: Readonly<Record<string, string | undefined>>;
} & {
  modelValue: ContentDraft;
  onModelValueChange?: (value: ContentDraft) => void;
} & ComponentAttributes;
export const componentDefaults = { errors: () => ({}) };
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
  const responseLength = computed(() =>
    draft.value.faq.length > 0
      ? formatFaqResponse(normalizeFaqItems(draft.value.faq)).length
      : 0,
  );
  function add(): void {
    if (draft.value.faq.length < 20) {
      draft.value.faq.push({ answer: '', question: '' });
    }
  }
  function move(index: number, offset: -1 | 1): void {
    const target = index + offset;
    if (target < 0 || target >= draft.value.faq.length) {
      return;
    }
    const [item] = draft.value.faq.splice(index, 1);
    if (item) {
      draft.value.faq.splice(target, 0, item);
    }
  }
  return { draft, responseLength, add, move };
}
