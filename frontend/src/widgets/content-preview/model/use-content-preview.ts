import { computed, ref, watch } from '@frontend/shared/lib/model-state';
import { clientPreview } from '@frontend-common/entities/content/lib/client-preview';
import type { ContentDraft } from '@frontend/entities/content/model/types';
export function useContentPreview(props: {
  content: ContentDraft;
  startAction?: string | undefined;
}) {
  const action = ref(props.startAction ?? 'main');
  watch(
    () => props.startAction,
    (value) => {
      action.value = value ?? 'main';
    },
  );
  const preview = computed(() => clientPreview(props.content, action.value));
  return {
    action,
    response: computed(() => preview.value.response),
    buttonRows: computed(() => preview.value.buttonRows),
    empty: computed(() => preview.value.empty),
  };
}
