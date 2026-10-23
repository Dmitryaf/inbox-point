import type { QueryClient } from '@tanstack/react-query';
import type {
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend-common/entities/operations/model/types';

export interface InboxState {
  requests: readonly OperatorInboxRequest[];
  selectedId: string;
  messages: readonly OperatorInboxMessage[];
  messagesId: string;
  messagesLoading: boolean;
  messagesError: string;
  readError: string;
  loading: boolean;
  actionPending: boolean;
  actionError: string;
  notice: string;
  drafts: Record<string, string>;
}
export interface ReplyAttempt {
  requestId: string;
  text: string;
  idempotencyKey: string;
}
export interface InboxLifetime {
  active: boolean;
  generation: number;
  refreshVersion: number;
  messagesVersion: number;
  command: boolean;
  failedReplies: Record<string, ReplyAttempt>;
}
export interface InboxContext {
  get: () => InboxState;
  patch: (patch: Partial<InboxState>) => void;
  lifetime: InboxLifetime;
  client: QueryClient;
  key: readonly unknown[];
  expire: () => void;
}
export function initialInbox(): InboxState {
  return {
    requests: [],
    selectedId: '',
    messages: [],
    messagesId: '',
    messagesLoading: false,
    messagesError: '',
    readError: '',
    loading: false,
    actionPending: false,
    actionError: '',
    notice: '',
    drafts: {},
  };
}
export function messagesReady(state: InboxState): boolean {
  return Boolean(
    state.selectedId &&
    state.messagesId === state.selectedId &&
    !state.messagesError &&
    state.requests.some((request) => request.id === state.selectedId),
  );
}
