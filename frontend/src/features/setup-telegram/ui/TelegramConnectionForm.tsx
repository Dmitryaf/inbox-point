import { useTelegramConnection } from '@frontend/features/setup-telegram/model/use-telegram-connection';
import styles from '@frontend/entities/setup/styles/setup-card.module.css';
import { TelegramSetupInstructions } from './TelegramSetupInstructions';

export function TelegramConnectionForm({
  locked,
  onConnected,
}: {
  locked: boolean;
  onConnected: () => void;
}) {
  const connection = useTelegramConnection(onConnected);
  const { botToken, chats, selectedChatId, pending, error } = connection;
  return (
    <>
      <p className={styles['setup-technical-note']}>
        Для этой настройки нужны права владельца бота и группы, а также токен от
        @BotFather. Если вы отвечаете клиентам, попросите владельца подключения
        выполнить эти шаги.
      </p>
      <TelegramSetupInstructions />
      {locked ? (
        <p
          className={`${styles['setup-status']} ${styles['setup-status--info']}`}
        >
          Telegram подключён при установке. Если он не работает, откройте раздел
          «Мониторинг».
        </p>
      ) : (
        <>
          <label htmlFor="telegram-token">
            Токен бота — строка-пароль от @BotFather
          </label>
          <input
            id="telegram-token"
            value={botToken}
            onChange={(event) => connection.changeToken(event.target.value)}
            autoComplete="off"
            type="password"
            disabled={pending === 'connect'}
          />
          <button
            disabled={Boolean(pending) || botToken.trim().length < 20}
            type="button"
            onClick={connection.discover}
          >
            {pending === 'discover'
              ? 'Проверяем…'
              : 'Проверить токен и найти группу'}
          </button>
          {chats.length > 0 && (
            <>
              <fieldset
                className={styles['setup-options']}
                disabled={Boolean(pending)}
              >
                <legend>Группа администраторов</legend>
                {chats.map((chat) => (
                  <label key={chat.id}>
                    <input
                      name="operator-chat"
                      type="radio"
                      checked={selectedChatId === chat.id}
                      onChange={() => connection.setSelectedChatId(chat.id)}
                    />
                    <span>
                      {chat.isForum
                        ? chat.title
                        : `${chat.title} — включите темы`}
                    </span>
                  </label>
                ))}
              </fieldset>
              <button
                disabled={Boolean(pending) || selectedChatId === null}
                type="button"
                onClick={connection.connect}
              >
                {pending === 'connect' ? 'Подключаем…' : 'Подключить Telegram'}
              </button>
            </>
          )}
          <p
            className={`${styles['setup-status']} ${styles[error ? 'setup-status--error' : 'setup-status--info']}`}
            role={error ? 'alert' : 'status'}
          >
            {error || connection.message}
          </p>
        </>
      )}
    </>
  );
}
