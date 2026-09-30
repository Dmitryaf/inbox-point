import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { ref } from '@frontend/shared/lib/model-state';
import { loadContentRevision } from '@frontend/entities/content/api/content-api';
import type { ContentSnapshot } from '@frontend/entities/content/model/types';

import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

export type ComponentProps = {
  hasUnsavedChanges: boolean;
  pending: boolean;
  revision: number;
} & EventProps<{
  restore: [revision: number];
  unauthorized: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const emit = $emit;
  const confirming = ref(false);
  const snapshot = ref<ContentSnapshot>();
  const loading = ref(false);
  const error = ref('');
  async function review(): Promise<void> {
    confirming.value = true;
    loading.value = true;
    error.value = '';
    snapshot.value = undefined;
    try {
      snapshot.value = await loadContentRevision(props.revision);
    } catch (cause: unknown) {
      error.value = requestErrorMessage(cause, () => emit('unauthorized'));
    } finally {
      loading.value = false;
    }
  }
  return { props, emit, confirming, snapshot, loading, error, review };
}
