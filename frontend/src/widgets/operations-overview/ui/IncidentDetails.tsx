import type { ReactNode } from 'react';
import styles from '@frontend/widgets/operations-overview/styles/incident-list.module.css';
export function IncidentDetails({
  facts,
}: {
  facts: readonly (readonly [string, ReactNode])[];
}) {
  return (
    <details className={styles['technical-details']}>
      <summary>Технические данные</summary>
      <dl className={styles['delivery-incident-context']}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
