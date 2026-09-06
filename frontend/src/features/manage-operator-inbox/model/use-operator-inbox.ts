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
import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

interface ReplyAttempt {
  idempotencyKey: string;
  requestId: string;
  text: string;
}

export function useOperatorInbox(onUnauthorized: () => void) {
  const actionPending = ref(false);
  const error = ref('');
  const loading = ref(false);
  const messages = ref<readonly OperatorInboxMessage[]>([]);
  const notice = ref('');
  const requests = ref<readonly OperatorInboxRequest[]>([]);
  const selectedRequestId = ref('');
  let failedReply: ReplyAttempt | undefined;

  const selectedRequest = computed(() =>
    requests.value.find((request) => request.id === selectedRequestId.value),
  );

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = '';
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
    } catch (cause: unknown) {
      handleError(cause);
    } finally {
      loading.value = false;
    }
  }

  async function select(requestId: string): Promise<void> {
    selectedRequestId.value = requestId;
    error.value = '';
    await refreshMessages();
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
    error.value = '';
    notice.value = '';
    try {
      await sendOperatorInboxReply(requestId, {
        idempotencyKey: attempt.idempotencyKey,
        text: attempt.text,
      });
      failedReply = undefined;
      notice.value =
        'Ответ добавлен в очередь. Итог доставки появится рядом с сообщением.';
      await refresh();
      return true;
    } catch (cause: unknown) {
      failedReply = attempt;
      handleError(cause);
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
    error.value = '';
    notice.value = '';
    try {
      await closeOperatorInboxRequest(requestId, crypto.randomUUID());
      notice.value = 'Обращение закрыто.';
      await refresh();
    } catch (cause: unknown) {
      handleError(cause);
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

  function handleError(cause: unknown): void {
    if (cause instanceof HttpError && cause.status === 401) {
      onUnauthorized();
      return;
    }
    error.value = errorMessage(cause);
  }

  return {
    actionPending,
    close,
    error,
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
