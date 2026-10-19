import { Outlet, useLocation } from 'react-router';

import { currentSection } from '@frontend/entities/navigation/model/sections';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';
import {
  UnsavedChangesProvider,
  useUnsavedChanges,
} from '@frontend/features/unsaved-changes/model/UnsavedChangesProvider';
import { useOrganizationName } from '@frontend/widgets/admin-shell/model/use-organization-name';
import styles from '@frontend/widgets/admin-shell/styles/admin-shell.module.css';
import { AdminPageHeader } from './AdminPageHeader';

export function AdminWorkspace() {
  return (
    <UnsavedChangesProvider>
      <Workspace />
    </UnsavedChangesProvider>
  );
}

function Workspace() {
  const session = useAdminSession();
  const { confirmExit } = useUnsavedChanges();
  const { pathname } = useLocation();
  const organizationName = useOrganizationName();
  function revokeAll(): void {
    if (
      confirmExit() &&
      window.confirm('Выйти из управления на всех устройствах?')
    ) {
      void session.endAllSessions();
    }
  }
  return (
    <div className={styles['admin-shell']}>
      <AdminPageHeader
        section={currentSection(pathname)}
        organizationName={organizationName}
        pending={session.pending}
        showLogout={session.mode === 'password'}
        onLogout={() => {
          if (confirmExit()) {
            void session.endSession();
          }
        }}
        onRevokeAll={revokeAll}
      />
      <main className={styles['admin-shell-content']}>
        {session.error && (
          <p className="message message--error" role="alert">
            {session.error}
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
