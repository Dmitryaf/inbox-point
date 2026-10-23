import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';
import { executeInboxAction } from './inbox-actions';
import { refreshInbox, refreshMessages } from './inbox-reads';
import {
  initialInbox,
  messagesReady,
  type InboxContext,
  type InboxLifetime,
  type InboxState,
} from './inbox-state';

export function useOperatorInbox() {
  const client = useQueryClient();
  const { epoch, expireSession } = useAdminSession();
  const [state, setState] = useState(initialInbox);
  const stateRef = useRef(state);
  const lifetime = useRef<InboxLifetime>({
    active: false,
    generation: 0,
    refreshVersion: 0,
    messagesVersion: 0,
    command: false,
    failedReplies: {},
  });
  const context = useCallback(
    (): InboxContext => ({
      client,
      key: ['session', epoch, 'operations', 'inbox'],
      lifetime: lifetime.current,
      get: () => stateRef.current,
      patch: (patch: Partial<InboxState>) => {
        if (!lifetime.current.active) {
          return;
        }
        stateRef.current = { ...stateRef.current, ...patch };
        setState(stateRef.current);
      },
      expire: () => expireSession(epoch),
    }),
    [client, epoch, expireSession],
  );
  const refresh = useCallback(() => refreshInbox(context()), [context]);
  useEffect(() => {
    const current = context();
    current.lifetime.active = true;
    current.lifetime.generation++;
    void refreshInbox(current);
    return () => {
      current.lifetime.active = false;
      current.lifetime.generation++;
      void client.cancelQueries({ queryKey: current.key });
    };
  }, [client, context]);
  return {
    state,
    refresh,
    ready: messagesReady(state),
    select: (id: string) => {
      const current = context();
      current.patch({ selectedId: id, actionError: '', notice: '' });
      void refreshMessages(current);
    },
    setDraft: (id: string, text: string) => {
      const current = context();
      current.patch({ drafts: { ...current.get().drafts, [id]: text } });
    },
    retryMessages: () => void refreshMessages(context()),
    reply: (text: string) => void executeInboxAction(context(), 'reply', text),
    close: () => void executeInboxAction(context(), 'close'),
  };
}
