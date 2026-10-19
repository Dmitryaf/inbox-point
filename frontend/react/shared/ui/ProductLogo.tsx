import styles from '@frontend/shared/styles/product-logo.module.css';

export function ProductLogo({
  className = '',
}: {
  className?: string | undefined;
}) {
  return (
    <span className={`${styles['product-logo']} ${className}`}>
      <span className={styles['product-logo__mark']} aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path d="M7.5 9.5h17v13h-17z" />
          <path d="M7.5 18h4.25l2.1 2.5h4.3l2.1-2.5h4.25" />
          <circle cx="22.5" cy="9.5" r="3" />
        </svg>
      </span>
      <span className={styles['product-logo__wordmark']}>
        Inbox <b>Point</b>
      </span>
    </span>
  );
}
