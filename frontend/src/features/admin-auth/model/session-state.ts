import type { AdminSessionSnapshot } from '@frontend-common/features/admin-auth/api/session-api';

export interface SessionState {
  authenticated: boolean;
  booting: boolean;
  pending: boolean;
  error: string;
  mode: AdminSessionSnapshot['mode'] | undefined;
  epoch: number;
}

type SessionAction =
  | { type: 'accepted'; snapshot: AdminSessionSnapshot; epoch: number }
  | { type: 'pending' }
  | { type: 'failure'; error: string }
  | { type: 'expired'; epoch: number };

export const initialSession: SessionState = {
  authenticated: false,
  booting: true,
  pending: false,
  error: '',
  mode: undefined,
  epoch: 0,
};

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case 'accepted':
      return {
        ...action.snapshot,
        epoch: action.epoch,
        booting: false,
        pending: false,
        error: '',
      };
    case 'pending':
      return { ...state, booting: false, pending: true, error: '' };
    case 'failure':
      return { ...state, booting: false, pending: false, error: action.error };
    case 'expired':
      return {
        ...state,
        authenticated: false,
        booting: false,
        pending: false,
        epoch: action.epoch,
        error: 'Сессия завершилась. Войдите снова.',
      };
  }
}
