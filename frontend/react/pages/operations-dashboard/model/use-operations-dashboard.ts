import { useCallback, useEffect, useRef, useState } from 'react';
import { readOperationsStatus } from '@frontend-common/entities/operations/api/operations-api';
import { loadServiceControl } from '@frontend-common/entities/service-control/api/service-control-api';
import { errorMessage } from '@frontend-common/shared/lib/error-message';
import { useOperationsQuery } from '@frontend/features/operations-control/model/use-operations-query';
import { useOperationsActions } from '@frontend/features/operations-control/model/use-operations-actions';
import { useOperatorInbox } from '@frontend/features/manage-operator-inbox/model/use-operator-inbox';

export function useOperationsDashboard() {
  const status = useOperationsQuery('status', readOperationsStatus);
  const control = useOperationsQuery(
    'control',
    loadServiceControl,
    Boolean(status.data),
  );
  const inbox = useOperatorInbox();
  const { refresh: refreshInbox } = inbox;
  const { refetch: refreshStatus } = status;
  const { refetch: refreshControl } = control;
  const [refreshError, setRefreshError] = useState('');
  const owner = useRef({ active: false, sequence: 0 });
  const refresh = useCallback(async () => {
    const sequence = ++owner.current.sequence;
    const results = await Promise.all([
      refreshStatus(),
      refreshControl(),
      refreshInbox(),
    ]);
    const error = results[0].error
      ? errorMessage(results[0].error)
      : results[1].error
        ? errorMessage(results[1].error)
        : results[2];
    if (owner.current.active && sequence === owner.current.sequence) {
      setRefreshError(error);
    }
    return error;
  }, [refreshStatus, refreshControl, refreshInbox]);
  const actions = useOperationsActions(refresh);
  useEffect(() => {
    const current = owner.current;
    current.active = true;
    const timer = setInterval(() => void refresh(), 30_000);
    return () => {
      current.active = false;
      current.sequence++;
      clearInterval(timer);
    };
  }, [refresh]);
  const readError =
    refreshError ||
    (status.error
      ? errorMessage(status.error)
      : control.error
        ? errorMessage(control.error)
        : inbox.state.readError);
  return { status, control, inbox, actions, refresh, readError };
}
