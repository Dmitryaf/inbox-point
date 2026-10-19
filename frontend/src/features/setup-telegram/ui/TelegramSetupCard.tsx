import { useState } from 'react';
import { disconnectTelegram } from '@frontend-common/entities/setup/api/setup-api';
import type { ChannelSetupStatus } from '@frontend-common/entities/setup/model/types';
import { useSetupCommand } from '@frontend/features/channel-setup/model/use-setup-command';
import styles from '@frontend/entities/setup/styles/setup-card.module.css';
import { TelegramConnectionForm } from './TelegramConnectionForm';

export function TelegramSetupCard({
  status,
  vkConfigured,
  onChange,
}: {
  status: ChannelSetupStatus;
  vkConfigured: boolean;
  onChange: (connected: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { pending, error, run } = useSetupCommand();
  function disconnect() {
    if (
      vkConfigured ||
      !window.confirm(
        'Отключить Telegram? Приложение перестанет получать сообщения из бота и передавать обращения в группу администраторов. История обращений сохранится.',
      )
    ) {
      return;
    }
    void run('disconnect', disconnectTelegram, () => onChange(false));
  }
  return (
    <section
      className={`card ${styles['setup-card']}`}
      aria-labelledby="telegram-setup-title"
    >
      <header className={styles['setup-card-heading']}>
        <div>
          <h2 id="telegram-setup-title">Telegram</h2>
          <p>Бот для клиентов и группа, где сотрудники отвечают на вопросы.</p>
        </div>
        <span
          className={`status-pill status-pill--${status.connected ? 'healthy' : 'neutral'}`}
        >
          {status.connected ? 'Подключён' : 'Не подключён'}
        </span>
      </header>
      <button
        className={`quiet ${styles['setup-toggle']}`}
        type="button"
        aria-expanded={expanded}
        aria-controls="telegram-setup-details"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? 'Скрыть'
          : status.source !== 'none'
            ? 'Сведения'
            : 'Подключить Telegram'}
      </button>
      <div
        hidden={!expanded}
        id="telegram-setup-details"
        className={styles['setup-details']}
      >
        {expanded && (
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
            ) : status.source === 'local' ? (
              <>
                {vkConfigured && (
                  <p
                    className={`${styles['setup-status']} ${styles['setup-status--info']}`}
                  >
                    Чтобы отключить Telegram, сначала отключите VK.
                  </p>
                )}
                <button
                  className="danger"
                  type="button"
                  disabled={Boolean(pending) || vkConfigured}
                  onClick={disconnect}
                >
                  {pending ? 'Отключаем…' : 'Отключить Telegram'}
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
            ) : (
              <TelegramConnectionForm
                locked={status.locked}
                onConnected={() => onChange(true)}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
