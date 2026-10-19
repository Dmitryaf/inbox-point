import {
  readOperatorInboxMessages,
  readOperatorInboxRequests,
} from '@frontend-common/entities/operations/api/operations-api';
import { HttpError } from '@frontend-common/shared/api/http-client';
import { errorMessage } from '@frontend-common/shared/lib/error-message';
import type { InboxContext } from './inbox-state';
import type { OperatorInboxRequest } from '@frontend-common/entities/operations/model/types';
import { isCancelledError } from '@tanstack/react-query';

export function inboxError(context: InboxContext, cause: unknown): string {
  if (cause instanceof HttpError && cause.status === 401) {
    context.expire();
    return '';
  }
  return errorMessage(cause);
}
export async function refreshMessages(context: InboxContext): Promise<void> {
  const { lifetime, get, patch, client, key } = context;
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
    patch({ messages: [], messagesId: '', messagesError: '' });
  }
  patch({ messagesLoading: Boolean(id) && !same });
  if (!id) {
    return;
  }
  try {
    const result = await client.fetchQuery({
      queryKey: [...key, 'messages', id],
      staleTime: 0,
      retry: false,
      queryFn: ({ signal }) => readOperatorInboxMessages(id, signal),
    });
    if (current()) {
      patch({
        messages: Array.isArray(result.messages) ? result.messages : [],
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
  const { lifetime, get, patch, client, key } = context;
  const version = ++lifetime.refreshVersion;
  const generation = lifetime.generation;
  const current = () =>
    lifetime.active &&
    lifetime.generation === generation &&
    lifetime.refreshVersion === version;
  patch({ loading: true, readError: '' });
  try {
    const result = await client.fetchQuery({
      queryKey: [...key, 'requests'],
      staleTime: 0,
      retry: false,
      queryFn: ({ signal }) => readOperatorInboxRequests(signal),
    });
    if (!current()) {
      return '';
    }
    const requests: readonly OperatorInboxRequest[] = Array.isArray(
      result.requests,
    )
      ? result.requests
      : [];
    const selectedId = requests.some(
      (request) => request.id === get().selectedId,
    )
      ? get().selectedId
      : (requests[0]?.id ?? '');
    patch({ requests, selectedId });
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
