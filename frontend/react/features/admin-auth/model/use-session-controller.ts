import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  login,
  logout,
  readSession,
  revokeAllSessions,
  type AdminSessionSnapshot,
} from '@frontend-common/features/admin-auth/api/session-api';
import { errorMessage } from '@frontend-common/shared/lib/error-message';
import { initialSession, sessionReducer } from './session-state';

export function useSessionController() {
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  const current = useRef({ sequence: 0, epoch: 0, pending: false });
  const cache = useQueryClient();
  const clearProtectedState = useCallback(() => {
    void cache.cancelQueries();
    cache.clear();
  }, [cache]);
  const accept = useCallback(
    (snapshot: AdminSessionSnapshot) => {
      const epoch = ++current.current.epoch;
      clearProtectedState();
      dispatch({ type: 'accepted', snapshot, epoch });
    },
    [clearProtectedState],
  );

  useEffect(() => {
    const lifetime = current.current;
    const controller = new AbortController();
    const sequence = ++lifetime.sequence;
    void readSession(controller.signal)
      .then((snapshot) => {
        if (sequence === lifetime.sequence) {
          accept(snapshot);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted && sequence === lifetime.sequence) {
          dispatch({ type: 'failure', error: errorMessage(cause) });
        }
      });
    return () => {
      controller.abort();
      lifetime.sequence++;
      clearProtectedState();
    };
  }, [accept, clearProtectedState]);

  const run = useCallback(
    async (action: () => Promise<AdminSessionSnapshot>): Promise<boolean> => {
      if (current.current.pending) {
        return false;
      }
      current.current.pending = true;
      const sequence = ++current.current.sequence;
      dispatch({ type: 'pending' });
      try {
        const snapshot = await action();
        if (sequence !== current.current.sequence) {
          return false;
        }
        accept(snapshot);
        return snapshot.authenticated;
      } catch (cause: unknown) {
        if (sequence === current.current.sequence) {
          dispatch({ type: 'failure', error: errorMessage(cause) });
        }
        return false;
      } finally {
        if (sequence === current.current.sequence) {
          current.current.pending = false;
        }
      }
    },
    [accept],
  );
  const authenticate = useCallback(
    (password: string, remember: boolean) =>
      run(() => login(password, remember)),
    [run],
  );
  const endSession = useCallback(() => run(logout), [run]);
  const endAllSessions = useCallback(() => run(revokeAllSessions), [run]);
  const expireSession = useCallback(
    (expectedEpoch: number) => {
      if (expectedEpoch !== current.current.epoch) {
        return;
      }
      current.current.sequence++;
      current.current.pending = false;
      const epoch = ++current.current.epoch;
      clearProtectedState();
      dispatch({ type: 'expired', epoch });
    },
    [clearProtectedState],
  );

  return { ...state, authenticate, endSession, endAllSessions, expireSession };
}
