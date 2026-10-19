import { createContext, useContext, type ReactNode } from 'react';

import { useSessionController } from './use-session-controller';

const SessionContext = createContext<ReturnType<
  typeof useSessionController
> | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionController();
  return <SessionContext value={session}>{children}</SessionContext>;
}

export function useAdminSession() {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('Admin session provider is missing');
  }
  return session;
}
