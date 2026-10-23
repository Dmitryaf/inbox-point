import type { useVkConnection } from '@frontend/features/setup-vk/model/use-vk-connection';
import styles from '@frontend/entities/setup/styles/setup-card.module.css';

export function VkConnectionForm({
  connection,
}: {
  connection: ReturnType<typeof useVkConnection>;
}) {
  const {
    accessToken,
    setAccessToken,
    community,
    setCommunity,
    pending,
    error,
  } = connection;
  return (
    <form
      className={styles['setup-form']}
      onSubmit={(event) => {
        event.preventDefault();
        connection.connect();
      }}
    >
      <label htmlFor="vk-community">Ссылка на страницу сообщества VK</label>
      <input
        id="vk-community"
        value={community}
        onChange={(event) => setCommunity(event.target.value)}
        placeholder="https://vk.com/your_community"
        required
        type="text"
        disabled={Boolean(pending)}
      />
      <label htmlFor="vk-token">Ключ с правами управления и сообщений</label>
      <input
        id="vk-token"
        value={accessToken}
        onChange={(event) => setAccessToken(event.target.value)}
        autoComplete="off"
        required
        type="password"
        disabled={Boolean(pending)}
      />
      <button
        disabled={Boolean(pending) || accessToken.trim().length < 20}
        type="submit"
      >
        {pending ? 'Подключаем…' : 'Подключить VK'}
      </button>
      <p
        className={`${styles['setup-status']} ${styles[error ? 'setup-status--error' : 'setup-status--info']}`}
        role={error ? 'alert' : 'status'}
      >
        {error || 'Выполните шаги и подключите сообщество.'}
      </p>
    </form>
  );
}
