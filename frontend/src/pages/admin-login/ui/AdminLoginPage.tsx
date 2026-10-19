import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  clearLoginDestination,
  clearLoginMessage,
  readLoginDestination,
  readLoginMessage,
} from '@frontend/features/admin-auth/lib/auth-navigation';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';
import { AdminLoginForm } from '@frontend/features/admin-auth/ui/AdminLoginForm';
import { ProductLogo } from '@frontend/shared/ui/ProductLogo';
import styles from '@frontend/pages/admin-login/styles/admin-login-page.module.css';

export function AdminLoginPage() {
  const session = useAdminSession();
  const navigate = useNavigate();
  const [entry] = useState(() => ({
    destination: readLoginDestination(),
    message: readLoginMessage(),
  }));
  useEffect(clearLoginMessage, []);
  useEffect(() => {
    if (!session.booting && session.authenticated) {
      clearLoginDestination();
      void navigate(entry.destination, { replace: true });
    }
  }, [session.booting, session.authenticated, navigate, entry.destination]);
  const error = session.error || entry.message;
  return (
    <main className={styles['login-page']}>
      <div className={styles['login-stack']}>
        <ProductLogo className={styles['login-brand']} />
        {error && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
        {session.booting ? (
          <p className={styles['login-state']} role="status">
            Проверяем доступ…
          </p>
        ) : (
          <AdminLoginForm
            pending={session.pending}
            onSubmit={session.authenticate}
          />
        )}
      </div>
    </main>
  );
}
