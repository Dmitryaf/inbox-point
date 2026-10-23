import { useQuery } from '@tanstack/react-query';
import { HttpError } from '@frontend-common/shared/api/http-client';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';

export function useOperationsQuery<T>(
  name: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const { epoch, expireSession } = useAdminSession();
  return useQuery({
    queryKey: ['session', epoch, 'operations', name],
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      try {
        return await load(signal);
      } catch (cause: unknown) {
        if (
          !signal.aborted &&
          cause instanceof HttpError &&
          cause.status === 401
        ) {
          expireSession(epoch);
        }
        throw cause;
      }
    },
  });
}
