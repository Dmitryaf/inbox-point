import { visibleRequestPages, visibleMessagePages } from './inbox-pages';
import { HttpError } from '@frontend-common/shared/api/http-client';
import { errorMessage } from '@frontend-common/shared/lib/error-message';
import type { InboxContext } from './inbox-state';
import { isCancelledError } from '@tanstack/react-query';

export function inboxError(context: InboxContext, cause: unknown): string {
  if (cause instanceof HttpError && cause.status === 401) {
    context.expire();
    return '';
  }
  return errorMessage(cause);
}
export async function refreshMessages(context: InboxContext): Promise<void> {
  const { lifetime, get, patch } = context;
  const id = get().selectedId;
  const version = ++lifetime.messagesVersion;
  const generation = lifetime.generation;
  const current = () =>
    lifetime.active &&
    lifetime.generation === generation &&
    lifetime.messagesVersion === version &&
    get().selectedId === id;
  const same = get().messagesId === id;
  if (!same) {
    patch({
      messages: [],
      messagesId: '',
      messagesError: '',
      messagesCursor: undefined,
    });
  }
  patch({
    messagesLoading: Boolean(id) && !same,
    moreMessagesLoading: false,
    moreMessagesError: '',
  });
  if (!id) {
    return;
  }
  try {
    const result = await visibleMessagePages(context, id, current);
    if (current() && result) {
      patch({
        messages: result.messages,
        messagesCursor: result.nextCursor,
        messagesId: id,
        messagesError: '',
      });
    }
  } catch (cause: unknown) {
    if (current() && !isCancelledError(cause)) {
      patch({ messagesError: inboxError(context, cause) });
    }
  } finally {
    if (current()) {
      patch({ messagesLoading: false });
    }
  }
}
export async function refreshInbox(context: InboxContext): Promise<string> {
  const { lifetime, get, patch } = context;
  const generation = lifetime.generation;
  await Promise.all(lifetime.pageReads);
  if (!lifetime.active || lifetime.generation !== generation) {
    return '';
  }
  const version = ++lifetime.refreshVersion;
  const current = () =>
    lifetime.active &&
    lifetime.generation === generation &&
    lifetime.refreshVersion === version;
  patch({
    loading: true,
    readError: '',
    moreRequestsLoading: false,
    moreRequestsError: '',
  });
  try {
    const result = await visibleRequestPages(context, current);
    if (!current() || !result) {
      return '';
    }
    const { requests } = result;
    const selectedId = requests.some(
      (request) => request.id === get().selectedId,
    )
      ? get().selectedId
      : (requests[0]?.id ?? '');
    patch({ requests, selectedId, requestsCursor: result.nextCursor });
    await refreshMessages(context);
    return '';
  } catch (cause: unknown) {
    if (!current() || isCancelledError(cause)) {
      return '';
    }
    const message = inboxError(context, cause);
    patch({ readError: message });
    return message;
  } finally {
    if (current()) {
      patch({ loading: false });
    }
  }
}
