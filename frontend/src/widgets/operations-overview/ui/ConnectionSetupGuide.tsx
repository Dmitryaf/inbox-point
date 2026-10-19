import { Link } from 'react-router';
import type { ChannelProblem } from '@frontend-common/entities/operations/lib/operations-attention';
import styles from '@frontend/widgets/operations-overview/styles/connection-setup-guide.module.css';
export function ConnectionSetupGuide({
  problems,
}: {
  problems: readonly ChannelProblem[];
}) {
  return (
    <section
      className={styles['connection-guide']}
      aria-label="Порядок подключения"
    >
      <ol className={styles['connection-guide-steps']}>
        {problems.map((problem, index) => (
          <li key={problem.channel}>
            <span className={styles['connection-step-number']}>
              {index + 1}
            </span>
            <div>
              <strong>{problem.channel}</strong>
              <p>{problem.action}</p>
            </div>
            <span className={styles['connection-step-status']}>
              Не подключён
            </span>
          </li>
        ))}
      </ol>
      <Link className={styles['connection-guide-action']} to="/setup">
        Начать подключение
      </Link>
      <p className={styles['connection-guide-note']}>
        На странице «Каналы» указаны шаги для владельца подключения. Для
        Telegram потребуется токен бота, для VK — ключ доступа сообщества.
      </p>
    </section>
  );
}
