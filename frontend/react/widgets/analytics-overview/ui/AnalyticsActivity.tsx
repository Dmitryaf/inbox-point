import { useState } from 'react';
import type { UsageDailyCount } from '@core/model/usage-event';
import styles from '@frontend/widgets/analytics-overview/styles/analytics-overview.module.css';

function label(date: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
export function AnalyticsActivity({ daily }: { daily: UsageDailyCount[] }) {
  const [expanded, setExpanded] = useState(false);
  const maximum = Math.max(
    1,
    ...daily.flatMap((day) => [day.requests, day.menuActions]),
  );
  const x = (index: number) =>
    48 + (index / Math.max(1, daily.length - 1)) * 604;
  const points = (key: 'requests' | 'menuActions') =>
    daily
      .map((day, index) => `${x(index)},${190 - (day[key] / maximum) * 160}`)
      .join(' ');
  const ticks = [
    ...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]),
  ].filter((index) => index >= 0);
  return (
    <section
      className={styles['analytics-activity']}
      aria-labelledby="activity-title"
    >
      <h2 id="activity-title">Активность по дням</h2>
      <p className={styles['chart-legend']}>
        <span>━ Выборы в меню</span>
        <span>┄ Обращения</span>
      </p>
      <svg
        className={styles['activity-chart']}
        viewBox="0 0 700 225"
        role="img"
        aria-label="Динамика действий меню и обращений. Точные значения доступны в таблице ниже."
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1="48"
              x2="652"
              y1={190 - fraction * 160}
              y2={190 - fraction * 160}
              className={styles['grid-line']}
            />
            <text x="38" y={195 - fraction * 160} textAnchor="end">
              {Math.round(maximum * fraction)}
            </text>
          </g>
        ))}
        <polyline
          points={points('menuActions')}
          className={styles['menu-line']}
        />
        <polyline
          points={points('requests')}
          className={styles['request-line']}
        />
        {ticks.map((index) => (
          <text
            key={index}
            x={x(index)}
            y="218"
            textAnchor={
              index === 0
                ? 'start'
                : index === daily.length - 1
                  ? 'end'
                  : 'middle'
            }
          >
            {daily[index] ? label(daily[index].date) : ''}
          </text>
        ))}
      </svg>
      <button
        className={`secondary-button ${styles['daily-toggle']}`}
        type="button"
        aria-controls="daily-values"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Скрыть значения по дням' : 'Показать значения по дням'}
      </button>
      <div
        id="daily-values"
        className={`${styles['daily-values']} ${expanded ? styles['daily-values--expanded'] : ''}`}
        tabIndex={0}
        role="region"
        aria-label="Значения по дням"
      >
        <table
          className={styles['analytics-table']}
          aria-label="Активность по дням"
        >
          <thead>
            <tr>
              <th scope="col">Дата</th>
              <th scope="col">Меню</th>
              <th scope="col">Обращения</th>
            </tr>
          </thead>
          <tbody>
            {[...daily].reverse().map((day) => (
              <tr key={day.date}>
                <th scope="row">{label(day.date)}</th>
                <td>{day.menuActions}</td>
                <td>{day.requests}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
