import { useAnalytics } from '@frontend/pages/analytics/model/use-analytics';
import { AnalyticsOverview } from '@frontend/widgets/analytics-overview/ui/AnalyticsOverview';
import styles from '@frontend/pages/analytics/styles/analytics-page.module.css';

const periods = [
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
] as const;
const channels = [
  { value: 'all', label: 'Все каналы' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'vk', label: 'VK' },
] as const;
export function AnalyticsPage() {
  const { period, channel, setPeriod, setChannel, query } = useAnalytics();
  const report = query.data;
  const empty =
    report?.summary.requests === 0 && report.summary.menuActions === 0;
  return (
    <section
      className={styles['analytics-page']}
      aria-label="Использование ботов"
    >
      <div className={styles['analytics-filters']}>
        <div role="group" aria-label="Период">
          {periods.map((item) => (
            <button
              key={item.value}
              className="quiet"
              type="button"
              aria-pressed={period === item.value}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Канал">
          {channels.map((item) => (
            <button
              key={item.value}
              className="quiet"
              type="button"
              aria-pressed={channel === item.value}
              onClick={() => setChannel(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {query.isFetching ? (
        <section className="card" role="status">
          <p>Загружаем аналитику…</p>
        </section>
      ) : query.isError ? (
        <section className="card message--error" role="alert">
          <p>Не удалось загрузить аналитику. Повторите попытку.</p>
          <button
            className="quiet"
            type="button"
            onClick={() => void query.refetch()}
          >
            Повторить попытку
          </button>
        </section>
      ) : empty ? (
        <section className={`card ${styles['analytics-empty']}`} role="status">
          <h2>Пока нет активности</h2>
          <p>
            За выбранный период в этих каналах нет обращений и действий меню.
          </p>
          <p>
            Когда пользователи начнут взаимодействовать с ботами, здесь появится
            статистика.
          </p>
        </section>
      ) : report ? (
        <AnalyticsOverview report={report} />
      ) : null}
    </section>
  );
}
