import { computed, ref, type Ref } from 'vue';
import { readOperatorInboxMessages } from '@frontend/entities/operations/api/operations-api';
import type { OperatorInboxMessage } from '@frontend/entities/operations/model/types';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';
export function useOperatorMessages(
  selectedRequestId: Ref<string>,
  onUnauthorized: () => void,
) {
  const messages = ref<readonly OperatorInboxMessage[]>([]);
  const messagesLoading = ref(false);
  const messagesError = ref('');
  const messagesRequestId = ref('');
  let messagesVersion = 0;
  const messagesReady = computed(
    () =>
      !!selectedRequestId.value &&
      messagesRequestId.value === selectedRequestId.value &&
      !messagesError.value,
  );
  async function refreshMessages(): Promise<void> {
    const requestId = selectedRequestId.value;
    const version = ++messagesVersion;
    const sameConversation = messagesRequestId.value === requestId;
    if (!sameConversation) {
      messagesError.value = '';
      messagesRequestId.value = '';
      messages.value = [];
    }
    messagesLoading.value = !!requestId && !sameConversation;
    if (!requestId) {
      return;
    }
    try {
      const result = await readOperatorInboxMessages(requestId);
      if (
        version !== messagesVersion ||
        requestId !== selectedRequestId.value
      ) {
        return;
      }
      messages.value = Array.isArray(result.messages) ? result.messages : [];
      messagesRequestId.value = requestId;
      messagesError.value = '';
    } catch (cause: unknown) {
      if (
        version !== messagesVersion ||
        requestId !== selectedRequestId.value
      ) {
        return;
      }
      messagesError.value = requestErrorMessage(cause, onUnauthorized);
    } finally {
      if (version === messagesVersion) {
        messagesLoading.value = false;
      }
    }
  }

  return {
    messages,
    messagesLoading,
    messagesError,
    messagesReady,
    refreshMessages,
  };
}
