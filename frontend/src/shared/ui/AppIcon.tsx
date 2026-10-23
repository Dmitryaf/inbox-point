import styles from '@frontend/shared/styles/app-icon.module.css';
export function AppIcon({ name }: { name: 'core' | 'faq' | 'custom' }) {
  return (
    <svg
      className={styles['app-icon']}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      {name === 'core' ? (
        <>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </>
      ) : name === 'faq' ? (
        <>
          <path d="M5 5h14v11H9l-4 3V5Z" />
          <path d="M9.5 9a2.5 2.5 0 0 1 4.8 1c0 1.8-2.3 1.8-2.3 3" />
          <path d="M12 14.7h.01" />
        </>
      ) : (
        <>
          <path d="M12 3v18M3 12h18" />
          <circle cx="12" cy="12" r="8" />
        </>
      )}
    </svg>
  );
}
