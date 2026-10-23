import type { AnalyticsReport } from '@frontend-common/entities/analytics/model/types';
import styles from '@frontend/widgets/analytics-overview/styles/analytics-overview.module.css';
import { AnalyticsActivity } from './AnalyticsActivity';

export function AnalyticsOverview({ report }: { report: AnalyticsReport }) {
  const questionChoices = report.actions
    .filter(
      (action) => action.key === 'handoff' || action.key === 'new_question',
    )
    .reduce((sum, action) => sum + action.count, 0);
  const lastRequest = report.lastRequestAt
    ? new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(report.lastRequestAt))
    : '';
  return (
    <article
      className={styles['analytics-overview']}
      aria-live="polite"
      aria-label="Отчёт об использовании"
    >
      <header className={styles['analytics-summary']}>
        <h2>Использование за период</h2>
        <dl className={styles['usage-totals']}>
          <div>
            <dt>Обращения</dt>
            <dd className={styles['metric-value']}>
              {report.summary.requests}
            </dd>
          </div>
          <div>
            <dt>Выборы в меню</dt>
            <dd className={styles['metric-value']}>
              {report.summary.menuActions}
            </dd>
          </div>
        </dl>
        {report.channel === 'all' && (
          <dl
            className={styles['usage-channels']}
            aria-label="Использование каналов"
          >
            {Object.entries(report.channels).map(([channel, counts]) => (
              <div key={channel}>
                <dt>{channel === 'telegram' ? 'Telegram' : 'VK'}</dt>
                <dd>
                  Обращения: {counts.requests} · Выборы в меню:{' '}
                  {counts.menuActions}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </header>
      <div className={styles['analytics-reading']}>
        <section
          className={styles['menu-usage']}
          aria-labelledby="menu-usage-title"
        >
          <h2 id="menu-usage-title">Что выбирают в меню</h2>
          {!report.actions.length ? (
            <p className={styles.muted}>
              За этот период действий меню пока нет.
            </p>
          ) : (
            <table className={styles['analytics-table']}>
              <thead>
                <tr>
                  <th scope="col">Действие</th>
                  <th scope="col">Всего</th>
                  {report.channel === 'all' && (
                    <>
                      <th scope="col" aria-label="Telegram">
                        <span className={styles['channel-name-full']}>
                          Telegram
                        </span>
                        <abbr
                          className={styles['channel-name-short']}
                          title="Telegram"
                        >
                          TG
                        </abbr>
                      </th>
                      <th scope="col">VK</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {report.actions.map((action) => (
                  <tr key={action.key}>
                    <th scope="row">{action.label}</th>
                    <td>{action.count}</td>
                    {report.channel === 'all' && (
                      <>
                        <td>{action.telegram}</td>
                        <td>{action.vk}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section
          className={styles['question-context']}
          aria-labelledby="question-context-title"
        >
          <h2 id="question-context-title">Кнопки для вопросов</h2>
          <dl className={styles['question-path']}>
            <div>
              <dt>Выборы «Задать вопрос» и «Начать новый вопрос»</dt>
              <dd>{questionChoices}</dd>
            </div>
          </dl>
          <p className={styles.muted}>
            {lastRequest
              ? `Последнее за период: ${lastRequest}`
              : 'За этот период обращений пока нет.'}
          </p>
        </section>
      </div>
      <AnalyticsActivity daily={report.daily} />
    </article>
  );
}
