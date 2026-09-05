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
  formatAddressResponse,
  formatListResponse,
} from '@frontend/entities/content/lib/client-response-preview';
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
  const scheduleLength = computed(() =>
    draft.value.schedule.trim()
      ? formatListResponse('Расписание', draft.value.schedule).length
      : 0,
  );
  const pricesLength = computed(() =>
    draft.value.prices.trim()
      ? formatListResponse('Цены', draft.value.prices).length
      : 0,
  );
  const addressLength = computed(() =>
    draft.value.address.trim()
      ? formatAddressResponse(draft.value.address).length
      : 0,
  );
  return { draft, scheduleLength, pricesLength, addressLength };
}
