import type { OperatorInboxRequest } from '@frontend-common/entities/operations/model/types';
import { formatShortDateTime } from '@frontend-common/shared/lib/format-date-time';
import styles from '@frontend/widgets/operator-inbox/styles/operator-request-list.module.css';
export function OperatorRequestList({
  requests,
  selectedId,
  onSelect,
}: {
  requests: readonly OperatorInboxRequest[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      className={styles['operator-request-list']}
      aria-label="Активные обращения"
    >
      {requests.map((request) => (
        <button
          key={request.id}
          className={`${styles['operator-request-button']} ${request.id === selectedId ? styles['operator-request-button--selected'] : ''}`}
          type="button"
          aria-pressed={request.id === selectedId}
          onClick={() => onSelect(request.id)}
        >
          <strong>
            {request.displayName?.length ? request.displayName : 'Без имени'}
          </strong>{' '}
          <span className={styles['channel-badge']}>
            {request.channel === 'telegram' ? 'Telegram' : 'VK'}
          </span>{' '}
          <time
            dateTime={
              request.latestMessageAt?.length
                ? request.latestMessageAt
                : request.createdAt
            }
          >
            {formatShortDateTime(
              request.latestMessageAt?.length
                ? request.latestMessageAt
                : request.createdAt,
            )}
          </time>
        </button>
      ))}
    </nav>
  );
}
