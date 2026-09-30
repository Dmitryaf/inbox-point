import { ref, type Ref } from 'vue';
import {
  closeOperatorInboxRequest,
  sendOperatorInboxReply,
} from '@frontend/entities/operations/api/operations-api';
import { resolveOperatorInboxActionError } from './operator-inbox-action-error';
type ReplyAttempt = Parameters<typeof sendOperatorInboxReply>[1] & {
  requestId: string;
};
export function useOperatorActions(
  selectedRequestId: Ref<string>,
  messagesReady: Readonly<Ref<boolean>>,
  drafts: Ref<Record<string, string>>,
  refresh: () => Promise<string>,
  onUnauthorized: () => void,
) {
  const actionPending = ref(false),
    actionError = ref(''),
    notice = ref('');
  let failedReply: ReplyAttempt | undefined;
  async function reply(text: string): Promise<boolean> {
    const requestId = selectedRequestId.value;
    if (
      !requestId ||
      actionPending.value ||
      !messagesReady.value ||
      !text.trim()
    ) {
      return false;
    }
    const attempt =
      failedReply?.requestId === requestId && failedReply.text === text.trim()
        ? failedReply
        : {
            idempotencyKey: crypto.randomUUID(),
            requestId,
            text: text.trim(),
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
      if (drafts.value[requestId] === text) {
        delete drafts.value[requestId];
      }
      notice.value =
        'Ответ сохранён для отправки. Результат появится рядом с сообщением.';
      actionError.value = await refresh();
      return true;
    } catch (cause: unknown) {
      failedReply = attempt;
      await handleActionError(cause);
      return false;
    } finally {
      actionPending.value = false;
    }
  }

  async function close(): Promise<void> {
    const requestId = selectedRequestId.value;
    if (!requestId || actionPending.value || !messagesReady.value) {
      return;
    }
    actionPending.value = true;
    actionError.value = '';
    notice.value = '';
    try {
      await closeOperatorInboxRequest(requestId, crypto.randomUUID());
      delete drafts.value[requestId];
      notice.value = 'Обращение закрыто.';
      actionError.value = await refresh();
    } catch (cause: unknown) {
      await handleActionError(cause);
    } finally {
      actionPending.value = false;
    }
  }

  async function handleActionError(cause: unknown): Promise<void> {
    actionError.value = await resolveOperatorInboxActionError(
      cause,
      onUnauthorized,
      refresh,
    );
  }

  return { actionPending, actionError, notice, reply, close };
}
