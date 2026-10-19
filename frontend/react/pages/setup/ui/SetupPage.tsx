import { useQuery, useQueryClient } from '@tanstack/react-query';
import { readSetupStatus } from '@frontend-common/entities/setup/api/setup-api';
import type { SetupStatus } from '@frontend-common/entities/setup/model/types';
import { HttpError } from '@frontend-common/shared/api/http-client';
import { errorMessage } from '@frontend-common/shared/lib/error-message';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';
import { TelegramSetupCard } from '@frontend/features/setup-telegram/ui/TelegramSetupCard';
import { VkSetupCard } from '@frontend/features/setup-vk/ui/VkSetupCard';
import styles from '@frontend/pages/setup/styles/setup-page.module.css';

export function SetupPage() {
  const { epoch, expireSession } = useAdminSession();
  const client = useQueryClient();
  const queryKey = ['session', epoch, 'setup'];
  const query = useQuery({
    queryKey,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      try {
        return await readSetupStatus(signal);
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
  function mark(channel: 'telegram' | 'vk', connected: boolean) {
    const next = {
      connected,
      locked: connected,
      source: connected ? ('local' as const) : ('none' as const),
    };
    client.setQueryData<SetupStatus>(queryKey, (previous) =>
      previous
        ? channel === 'vk'
          ? { ...previous, vk: next }
          : { ...previous, ...next }
        : previous,
    );
    void client.invalidateQueries({ queryKey, refetchType: 'none' });
  }
  const status = query.data;
  return (
    <section className={styles['setup-page']}>
      {query.isFetching ? (
        <p className="state-card card" role="status">
          Проверяем подключения…
        </p>
      ) : query.isError ? (
        <>
          <p className="message--error" role="alert">
            {errorMessage(query.error)}
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void query.refetch()}
          >
            Повторить проверку подключений
          </button>
        </>
      ) : status ? (
        <div className={styles['setup-workspace']}>
          <div
            className={`${styles['setup-channel-grid']} ${status.connected !== status.vk.connected ? styles['setup-channel-grid--mixed'] : ''}`}
          >
            <TelegramSetupCard
              status={status}
              vkConfigured={status.vk.source !== 'none'}
              onChange={(connected) => mark('telegram', connected)}
            />
            <VkSetupCard
              status={status.vk}
              telegramConnected={status.connected}
              onChange={(connected) => mark('vk', connected)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
