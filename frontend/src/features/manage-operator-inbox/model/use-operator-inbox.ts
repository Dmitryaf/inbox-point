import { computed, ref } from 'vue';

import { readOperatorInboxRequests } from '@frontend/entities/operations/api/operations-api';
import type { OperatorInboxRequest } from '@frontend/entities/operations/model/types';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';
import { useOperatorMessages } from './use-operator-messages';
import { useOperatorActions } from './use-operator-actions';

export function useOperatorInbox(onUnauthorized: () => void) {
  const loading = ref(false);
  const drafts = ref<Record<string, string>>({});
  const requests = ref<readonly OperatorInboxRequest[]>([]);
  const selectedRequestId = ref('');
  let refreshVersion = 0;

  const messageState = useOperatorMessages(selectedRequestId, onUnauthorized);
  const { refreshMessages, messagesReady } = messageState;
  const actions = useOperatorActions(
    selectedRequestId,
    messagesReady,
    drafts,
    refresh,
    onUnauthorized,
  );

  const selectedRequest = computed(() =>
    requests.value.find((request) => request.id === selectedRequestId.value),
  );

  async function refresh(): Promise<string> {
    const version = ++refreshVersion;
    loading.value = true;
    try {
      const result = await readOperatorInboxRequests();
      if (version !== refreshVersion) {
        return '';
      }
      requests.value = Array.isArray(result.requests) ? result.requests : [];
      if (
        !requests.value.some(
          (request) => request.id === selectedRequestId.value,
        )
      ) {
        selectedRequestId.value = requests.value[0]?.id ?? '';
      }
      await refreshMessages();
      return '';
    } catch (cause: unknown) {
      if (version !== refreshVersion) {
        return '';
      }
      return requestErrorMessage(cause, onUnauthorized);
    } finally {
      if (version === refreshVersion) {
        loading.value = false;
      }
    }
  }

  async function select(requestId: string): Promise<void> {
    selectedRequestId.value = requestId;
    actions.actionError.value = '';
    actions.notice.value = '';
    await refreshMessages();
  }

  function setDraft(requestId: string, text: string): void {
    drafts.value[requestId] = text;
  }

  return {
    ...messageState,
    ...actions,
    drafts,
    loading,
    refresh,
    requests,
    select,
    setDraft,
    selectedRequest,
    selectedRequestId,
  };
}
