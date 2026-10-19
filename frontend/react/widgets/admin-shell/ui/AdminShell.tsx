import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { rememberAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';
import styles from '@frontend/widgets/admin-shell/styles/admin-shell.module.css';
import { AdminWorkspace } from './AdminWorkspace';

export function AdminShell() {
  const session = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!session.booting && !session.authenticated) {
      rememberAdminLogin(location.pathname, session.error || undefined);
      void navigate('/login', { replace: true });
    }
  }, [
    session.booting,
    session.authenticated,
    session.error,
    location.pathname,
    navigate,
  ]);
  if (session.booting) {
    return (
      <div className={styles['admin-shell-state']} role="status">
        Проверяем доступ…
      </div>
    );
  }
  if (!session.authenticated) {
    return null;
  }
  return <AdminWorkspace />;
}
