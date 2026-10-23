import {
  closeOperatorInboxRequest,
  sendOperatorInboxReply,
} from '@frontend-common/entities/operations/api/operations-api';
import { HttpError } from '@frontend-common/shared/api/http-client';
import { inboxError, refreshInbox } from './inbox-reads';
import { messagesReady, type InboxContext } from './inbox-state';

export async function executeInboxAction(
  context: InboxContext,
  kind: 'reply' | 'close',
  text = '',
): Promise<void> {
  const { get, patch, lifetime, client, key } = context;
  const requestId = get().selectedId;
  if (
    !lifetime.active ||
    lifetime.command ||
    !messagesReady(get()) ||
    (kind === 'reply' && !text.trim())
  ) {
    return;
  }
  const generation = lifetime.generation;
  const current = () => lifetime.active && lifetime.generation === generation;
  const failed = lifetime.failedReplies[requestId];
  const attempt =
    kind === 'reply' &&
    failed?.requestId === requestId &&
    failed.text === text.trim()
      ? failed
      : { requestId, text: text.trim(), idempotencyKey: crypto.randomUUID() };
  const draftSnapshot = get().drafts[requestId];
  let confirmed = false;
  lifetime.command = true;
  patch({ actionPending: true, actionError: '', notice: '' });
  await client.cancelQueries({ queryKey: key });
  lifetime.refreshVersion++;
  lifetime.messagesVersion++;
  try {
    if (!current()) {
      return;
    }
    if (kind === 'reply') {
      await sendOperatorInboxReply(requestId, {
        text: attempt.text,
        idempotencyKey: attempt.idempotencyKey,
      });
    } else {
      await closeOperatorInboxRequest(requestId, attempt.idempotencyKey);
    }
    confirmed = true;
    if (!current()) {
      return;
    }
    delete lifetime.failedReplies[requestId];
    const drafts = { ...get().drafts };
    if (drafts[requestId] === (kind === 'reply' ? text : draftSnapshot)) {
      delete drafts[requestId];
    }
    patch({
      drafts,
      notice:
        kind === 'reply'
          ? 'Ответ сохранён для отправки. Результат появится рядом с сообщением.'
          : 'Обращение закрыто.',
    });
    await refreshInbox(context);
  } catch (cause: unknown) {
    if (!current()) {
      return;
    }
    if (kind === 'reply' && !confirmed) {
      lifetime.failedReplies[requestId] = attempt;
    }
    const message = inboxError(context, cause);
    if (cause instanceof HttpError && cause.status === 409) {
      patch({ messagesId: '' });
      await refreshInbox(context);
    }
    if (current()) {
      patch({ actionError: message });
    }
    return;
  } finally {
    if (current()) {
      lifetime.command = false;
      patch({ actionPending: false });
    }
  }
}
