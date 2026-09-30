import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { useCollectionEditor } from '@frontend/entities/content/lib/use-collection-editor';
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
  const { add, move, remove, itemKey } = useCollectionEditor({
    items: () => draft.value.faq,
    create: () => ({ answer: '', question: '' }),
    limit: 20,
    fieldPrefix: 'faq-question',
    description: (item, index) =>
      `вопрос «${item.question.trim() || index + 1}»`,
    hasContent: (item) => !!(item.question.trim() || item.answer.trim()),
  });
  return { draft, responseLength, add, move, remove, itemKey };
}
