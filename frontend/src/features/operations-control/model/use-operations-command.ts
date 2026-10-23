import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HttpError } from '@frontend-common/shared/api/http-client';
import { errorMessage } from '@frontend-common/shared/lib/error-message';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';

export function useOperationsCommand(refresh: () => Promise<unknown>) {
  const { epoch, expireSession } = useAdminSession();
  const client = useQueryClient();
  const owner = useRef({ active: false, generation: 0, busy: false });
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    lifetime.generation++;
    return () => {
      lifetime.active = false;
      lifetime.generation++;
    };
  }, []);
  async function run<T>(
    id: string,
    action: () => Promise<T>,
    successNotice: string,
    confirm?: string,
    accept?: (result: T) => void,
  ) {
    const lifetime = owner.current;
    if (
      !lifetime.active ||
      lifetime.busy ||
      (confirm && !window.confirm(confirm))
    ) {
      return;
    }
    const generation = lifetime.generation;
    const current = () => lifetime.active && lifetime.generation === generation;
    lifetime.busy = true;
    setPending(id);
    setError('');
    setNotice('');
    try {
      await client.cancelQueries({
        queryKey: ['session', epoch, 'operations'],
      });
      if (!current()) {
        return;
      }
      const result = await action();
      if (!current()) {
        return;
      }
      accept?.(result);
      setNotice(successNotice);
    } catch (cause: unknown) {
      if (current()) {
        if (cause instanceof HttpError && cause.status === 401) {
          expireSession(epoch);
        } else {
          setError(errorMessage(cause));
        }
      }
      if (current()) {
        lifetime.busy = false;
        setPending('');
      }
      return;
    }
    // Refresh failure is independent of a confirmed command; never replay it.
    try {
      if (current()) {
        await refresh();
      }
    } finally {
      if (current()) {
        lifetime.busy = false;
        setPending('');
      }
    }
  }
  return { pending, error, notice, run };
}
