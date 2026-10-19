import { useState } from 'react';
import { disconnectVk } from '@frontend-common/entities/setup/api/setup-api';
import type { ChannelSetupStatus } from '@frontend-common/entities/setup/model/types';
import { useSetupCommand } from '@frontend/features/channel-setup/model/use-setup-command';
import { useVkConnection } from '@frontend/features/setup-vk/model/use-vk-connection';
import styles from '@frontend/entities/setup/styles/setup-card.module.css';
import { VkConnectionForm } from './VkConnectionForm';
import { VkSetupInstructions } from './VkSetupInstructions';

export function VkSetupCard({
  status,
  telegramConnected,
  onChange,
}: {
  status: ChannelSetupStatus;
  telegramConnected: boolean;
  onChange: (connected: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { pending, error, run } = useSetupCommand();
  const connection = useVkConnection(() => onChange(true));
  const locked = !telegramConnected && !status.connected;
  function disconnect() {
    if (
      !window.confirm(
        'Отключить VK? Новые сообщения из сообщества перестанут появляться у администратора. История обращений сохранится.',
      )
    ) {
      return;
    }
    void run('disconnect', disconnectVk, () => onChange(false));
  }
  return (
    <section
      className={`card ${styles['setup-card']} ${locked ? styles['setup-card--locked'] : ''}`}
      aria-labelledby="vk-setup-title"
    >
      <header className={styles['setup-card-heading']}>
        <div>
          <h2 id="vk-setup-title">VK</h2>
          <p>
            Сообщения клиентов из сообщества приходят в ту же группу Telegram.
          </p>
        </div>
        <span
          className={`status-pill status-pill--${status.connected ? 'healthy' : 'neutral'}`}
        >
          {status.connected ? 'Подключён' : 'Не подключён'}
        </span>
      </header>
      <button
        className={`quiet ${styles['setup-toggle']}`}
        disabled={locked}
        type="button"
        aria-expanded={expanded}
        aria-controls="vk-setup-details"
        onClick={() => setExpanded(!expanded)}
      >
        {locked
          ? 'Сначала Telegram'
          : expanded
            ? 'Скрыть'
            : status.source !== 'none'
              ? 'Сведения'
              : 'Подключить VK'}
      </button>
      <div
        hidden={!expanded}
        id="vk-setup-details"
        className={styles['setup-details']}
      >
        {expanded && (
          <>
            {status.source !== 'none' ? (
              <>
                {status.connected && (
                  <p
                    className={`${styles['setup-status']} ${styles['setup-status--success']}`}
                    role="status"
                  >
                    Подключение активно.
                  </p>
                )}
                {status.source === 'environment' ? (
                  <p
                    className={`${styles['setup-status']} ${styles['setup-status--info']}`}
                  >
                    Управляется на сервере.
                  </p>
                ) : (
                  <>
                    <button
                      className="danger"
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={disconnect}
                    >
                      {pending ? 'Отключаем…' : 'Отключить VK'}
                    </button>
                    {error && (
                      <p
                        className={`${styles['setup-status']} ${styles['setup-status--error']}`}
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <VkSetupInstructions />
                {status.locked ? (
                  <p
                    className={`${styles['setup-status']} ${styles['setup-status--info']}`}
                  >
                    VK подключён при установке. Если он не работает, откройте
                    раздел «Мониторинг».
                  </p>
                ) : (
                  <VkConnectionForm connection={connection} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
