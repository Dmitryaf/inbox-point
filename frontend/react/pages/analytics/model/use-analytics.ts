import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadAnalytics } from '@frontend-common/entities/analytics/api/analytics-api';
import type {
  AnalyticsChannel,
  AnalyticsPeriod,
} from '@frontend-common/entities/analytics/model/types';
import { HttpError } from '@frontend-common/shared/api/http-client';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';

export function useAnalytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const [channel, setChannel] = useState<AnalyticsChannel>('all');
  const { epoch, expireSession } = useAdminSession();
  const query = useQuery({
    queryKey: ['session', epoch, 'analytics', period, channel],
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      try {
        return await loadAnalytics(period, channel, signal);
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
  return { period, channel, setPeriod, setChannel, query };
}
