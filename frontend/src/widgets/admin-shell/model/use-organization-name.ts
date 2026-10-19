import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router';

import { HttpError } from '@frontend-common/shared/api/http-client';
import { loadOrganizationName } from '@frontend/entities/organization/api/organization-api';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';

export function useOrganizationName(): string {
  const { authenticated, epoch, expireSession } = useAdminSession();
  const { pathname } = useLocation();
  const query = useQuery({
    queryKey: ['session', epoch, 'organization'],
    enabled: authenticated && pathname !== '/manage',
    queryFn: async ({ signal }) => {
      try {
        return await loadOrganizationName(signal);
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
  return query.data ?? '';
}
