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
  createItemKey,
  focusEditorField,
} from '@frontend/entities/content/lib/editor-focus';
import { formatListResponse } from '@frontend/entities/content/lib/client-response-preview';
import { normalizeScheduleItems } from '@frontend/entities/content/lib/schedule-response';
import { getCoreResponseLengths } from '@frontend/entities/content/lib/content-response-limit';
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
  $props: ResolvedProps,
  _emit: (event: string, ...args: unknown[]) => void,
  $model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
) {
  const draft = $model<ContentDraft>('modelValue', { required: true });
  const props = $props;
  const itemKey = createItemKey();
  const itemLimit = 20;
  const responseLength = computed(
    () => getCoreResponseLengths(draft.value).schedule,
  );
  const hasContent = computed(
    () =>
      normalizeScheduleItems(draft.value.schedule).length > 0 ||
      Boolean(draft.value.legacySchedule.trim()),
  );
  const legacyResponse = computed(() =>
    draft.value.legacySchedule.trim()
      ? formatListResponse('Расписание', draft.value.legacySchedule)
      : '',
  );
  function add(): void {
    if (draft.value.schedule.length < itemLimit) {
      draft.value.schedule.push({ dayTime: '', title: '' });
      void focusEditorField(
        `schedule-title-${draft.value.schedule.length - 1}`,
      );
    }
  }
  return {
    draft,
    props,
    itemKey,
    itemLimit,
    responseLength,
    hasContent,
    legacyResponse,
    add,
  };
}
