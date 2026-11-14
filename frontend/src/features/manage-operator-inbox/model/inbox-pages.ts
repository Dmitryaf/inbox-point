import {
  readOperatorInboxMessages,
  readOperatorInboxRequests,
} from '@frontend-common/entities/operations/api/operations-api';
import type {
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend-common/entities/operations/model/types';
import type { InboxContext } from './inbox-state';

export function mergeById<T extends { id: string }>(
  first: readonly T[],
  second: readonly T[],
): T[] {
  return [
    ...new Map([...first, ...second].map((item) => [item.id, item])).values(),
  ];
}
export function requestPage(context: InboxContext, cursor?: string) {
  return context.client.fetchQuery({
    queryKey: [...context.key, 'requests', cursor ?? 'first'],
    staleTime: 0,
    retry: false,
    queryFn: ({ signal }) => readOperatorInboxRequests(signal, cursor),
  });
}
export function messagePage(
  context: InboxContext,
  id: string,
  cursor?: string,
) {
  return context.client.fetchQuery({
    queryKey: [...context.key, 'messages', id, cursor ?? 'first'],
    staleTime: 0,
    retry: false,
    queryFn: ({ signal }) => readOperatorInboxMessages(id, signal, cursor),
  });
}

export async function visibleRequestPages(
  context: InboxContext,
  current: () => boolean,
) {
  const boundary = context.get().requests.at(-1);
  let requests: OperatorInboxRequest[] = [];
  let nextCursor: string | undefined;
  const visited = new Set<string>();
  do {
    const result = await requestPage(context, nextCursor);
    if (!current()) {
      return undefined;
    }
    requests = mergeById<OperatorInboxRequest>(
      requests,
      Array.isArray(result.requests) ? result.requests : [],
    );
    nextCursor = result.nextCursor;
    if (
      !nextCursor ||
      !boundary ||
      requests.some(
        (item) =>
          Date.parse(item.createdAt) < Date.parse(boundary.createdAt) ||
          (Date.parse(item.createdAt) === Date.parse(boundary.createdAt) &&
            item.id <= boundary.id),
      )
    ) {
      break;
    }
    if (visited.has(nextCursor)) {
      throw new Error('Repeated inbox cursor');
    }
    visited.add(nextCursor);
  } while (nextCursor);
  return { requests, nextCursor };
}

export async function visibleMessagePages(
  context: InboxContext,
  id: string,
  current: () => boolean,
) {
  const oldestId =
    context.get().messagesId === id ? context.get().messages[0]?.id : undefined;
  let messages: OperatorInboxMessage[] = [];
  let nextCursor: string | undefined;
  const visited = new Set<string>();
  do {
    const result = await messagePage(context, id, nextCursor);
    if (!current()) {
      return undefined;
    }
    messages = mergeById<OperatorInboxMessage>(
      Array.isArray(result.messages) ? result.messages : [],
      messages,
    );
    nextCursor = result.nextCursor;
    if (
      !nextCursor ||
      !oldestId ||
      messages.some((item) => item.id === oldestId)
    ) {
      break;
    }
    if (visited.has(nextCursor)) {
      throw new Error('Repeated message cursor');
    }
    visited.add(nextCursor);
  } while (nextCursor);
  return { messages, nextCursor };
}
