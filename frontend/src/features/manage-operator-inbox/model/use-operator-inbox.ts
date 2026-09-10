import { computed, ref } from 'vue';

import {
  closeOperatorInboxRequest,
  readOperatorInboxMessages,
  readOperatorInboxRequests,
  sendOperatorInboxReply,
} from '@frontend/entities/operations/api/operations-api';
import type {
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend/entities/operations/model/types';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

interface ReplyAttempt {
  idempotencyKey: string;
  requestId: string;
  text: string;
}

export function useOperatorInbox(onUnauthorized: () => void) {
  const actionPending = ref(false);
  const actionError = ref('');
  const loading = ref(false);
  const messages = ref<readonly OperatorInboxMessage[]>([]);
  const notice = ref('');
  const requests = ref<readonly OperatorInboxRequest[]>([]);
  const selectedRequestId = ref('');
  let failedReply: ReplyAttempt | undefined;

  const selectedRequest = computed(() =>
    requests.value.find((request) => request.id === selectedRequestId.value),
  );

  async function refresh(): Promise<string> {
    loading.value = true;
    try {
      const result = await readOperatorInboxRequests();
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
      return requestErrorMessage(cause, onUnauthorized);
    } finally {
      loading.value = false;
    }
  }

  async function select(requestId: string): Promise<void> {
    selectedRequestId.value = requestId;
    actionError.value = '';
    try {
      await refreshMessages();
    } catch (cause: unknown) {
      handleActionError(cause);
    }
  }

  async function reply(text: string): Promise<boolean> {
    const requestId = selectedRequestId.value;
    if (!requestId || actionPending.value) {
      return false;
    }
    const normalizedText = text.trim();
    const attempt =
      failedReply?.requestId === requestId &&
      failedReply.text === normalizedText
        ? failedReply
        : {
            idempotencyKey: crypto.randomUUID(),
            requestId,
            text: normalizedText,
          };
    actionPending.value = true;
    actionError.value = '';
    notice.value = '';
    try {
      await sendOperatorInboxReply(requestId, {
        idempotencyKey: attempt.idempotencyKey,
        text: attempt.text,
      });
      failedReply = undefined;
      notice.value =
        'Ответ сохранён для отправки. Результат появится рядом с сообщением.';
      actionError.value = await refresh();
      return true;
    } catch (cause: unknown) {
      failedReply = attempt;
      handleActionError(cause);
      return false;
    } finally {
      actionPending.value = false;
    }
  }

  async function close(): Promise<void> {
    const requestId = selectedRequestId.value;
    if (!requestId || actionPending.value) {
      return;
    }
    actionPending.value = true;
    actionError.value = '';
    notice.value = '';
    try {
      await closeOperatorInboxRequest(requestId, crypto.randomUUID());
      notice.value = 'Обращение закрыто.';
      actionError.value = await refresh();
    } catch (cause: unknown) {
      handleActionError(cause);
    } finally {
      actionPending.value = false;
    }
  }

  async function refreshMessages(): Promise<void> {
    if (!selectedRequestId.value) {
      messages.value = [];
      return;
    }
    const result = await readOperatorInboxMessages(selectedRequestId.value);
    messages.value = Array.isArray(result.messages) ? result.messages : [];
  }

  function handleActionError(cause: unknown): void {
    actionError.value = requestErrorMessage(cause, onUnauthorized);
  }

  return {
    actionError,
    actionPending,
    close,
    loading,
    messages,
    notice,
    refresh,
    reply,
    requests,
    select,
    selectedRequest,
    selectedRequestId,
  };
}
