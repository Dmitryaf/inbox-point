import { useEffect, useRef, useState } from 'react';
import { HttpError } from '@frontend-common/shared/api/http-client';
import { errorMessage } from '@frontend-common/shared/lib/error-message';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';

export function useSetupCommand() {
  const { epoch, expireSession } = useAdminSession();
  const lifetime = useRef({ active: false, generation: 0, busy: false });
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const owner = lifetime.current;
    owner.active = true;
    owner.generation++;
    return () => {
      owner.active = false;
      owner.generation++;
    };
  }, []);
  async function run<T>(
    name: string,
    action: () => Promise<T>,
    accept: (result: T) => void,
  ) {
    const owner = lifetime.current;
    if (!owner.active || owner.busy) {
      return;
    }
    const generation = owner.generation;
    owner.busy = true;
    setPending(name);
    setError('');
    const current = () => owner.active && owner.generation === generation;
    try {
      const result = await action();
      if (current()) {
        accept(result);
      }
    } catch (cause: unknown) {
      if (current()) {
        if (cause instanceof HttpError && cause.status === 401) {
          expireSession(epoch);
        } else {
          setError(errorMessage(cause));
        }
      }
    } finally {
      if (current()) {
        owner.busy = false;
        setPending('');
      }
    }
  }
  return { pending, error, run };
}
