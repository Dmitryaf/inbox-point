import { isCancelledError } from '@tanstack/react-query';
import { inboxError } from './inbox-reads';
import { mergeById, messagePage, requestPage } from './inbox-pages';
import type { InboxContext } from './inbox-state';

export function loadMoreRequests(context: InboxContext): Promise<void> {
  return trackRead(context, appendRequests(context));
}
export function loadOlderMessages(context: InboxContext): Promise<void> {
  return trackRead(context, prependMessages(context));
}
async function trackRead(
  context: InboxContext,
  read: Promise<void>,
): Promise<void> {
  context.lifetime.pageReads.add(read);
  try {
    await read;
  } finally {
    context.lifetime.pageReads.delete(read);
  }
}
async function appendRequests(context: InboxContext): Promise<void> {
  const { get, patch, lifetime } = context;
  const cursor = get().requestsCursor;
  if (
    !cursor ||
    get().loading ||
    get().moreRequestsLoading ||
    lifetime.command
  ) {
    return;
  }
  const version = lifetime.refreshVersion;
  const generation = lifetime.generation;
  const current = () =>
    lifetime.active &&
    lifetime.generation === generation &&
    lifetime.refreshVersion === version;
  patch({ moreRequestsLoading: true, moreRequestsError: '' });
  try {
    const page = await requestPage(context, cursor);
    if (current()) {
      patch({
        requests: mergeById(get().requests, page.requests),
        requestsCursor: page.nextCursor,
      });
    }
  } catch (cause: unknown) {
    if (current() && !isCancelledError(cause)) {
      patch({ moreRequestsError: inboxError(context, cause) });
    }
  } finally {
    if (current()) {
      patch({ moreRequestsLoading: false });
    }
  }
}

async function prependMessages(context: InboxContext): Promise<void> {
  const { get, patch, lifetime } = context;
  const cursor = get().messagesCursor;
  const id = get().selectedId;
  if (
    !cursor ||
    get().loading ||
    get().messagesLoading ||
    get().moreMessagesLoading ||
    lifetime.command
  ) {
    return;
  }
  const version = lifetime.messagesVersion;
  const generation = lifetime.generation;
  const current = () =>
    lifetime.active &&
    lifetime.generation === generation &&
    lifetime.messagesVersion === version &&
    get().selectedId === id;
  patch({ moreMessagesLoading: true, moreMessagesError: '' });
  try {
    const page = await messagePage(context, id, cursor);
    if (current()) {
      patch({
        messages: mergeById(page.messages, get().messages),
        messagesCursor: page.nextCursor,
      });
    }
  } catch (cause: unknown) {
    if (current() && !isCancelledError(cause)) {
      patch({ moreMessagesError: inboxError(context, cause) });
    }
  } finally {
    if (current()) {
      patch({ moreMessagesLoading: false });
    }
  }
}
