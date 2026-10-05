import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import { buildClientResponsePreviews } from '@frontend/entities/content/lib/client-response-preview';
import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';
import type { ContentDraft } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  content: ContentDraft;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const responses = computed(() => buildClientResponsePreviews(props.content));
  const validation = computed(() => validateContentDraft(props.content));
  const standardCount = computed(
    () =>
      responses.value.filter((response) => response.group === 'information')
        .length,
  );
  const customCount = computed(
    () =>
      responses.value.filter((response) => response.group === 'custom').length,
  );
  const summaryTitle = computed(() => {
    if (!validation.value.valid) {
      return 'Нужно исправить поля';
    }
    return responses.value.length ? 'Готово к показу' : 'Пока не заполнено';
  });
  return { responses, standardCount, customCount, summaryTitle };
}
