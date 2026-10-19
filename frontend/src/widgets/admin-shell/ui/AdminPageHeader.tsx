import { NavLink } from 'react-router';

import {
  sections,
  type AdminSection,
} from '@frontend/entities/navigation/model/sections';
import { ProductLogo } from '@frontend/shared/ui/ProductLogo';
import styles from '@frontend/widgets/admin-shell/styles/admin-page-header.module.css';

interface Props {
  section: AdminSection;
  organizationName: string;
  pending: boolean;
  showLogout: boolean;
  onLogout: () => void;
  onRevokeAll: () => void;
}

export function AdminPageHeader({
  section,
  organizationName,
  pending,
  showLogout,
  onLogout,
  onRevokeAll,
}: Props) {
  return (
    <header className={styles['admin-header']}>
      <div className={styles['admin-topbar']}>
        <NavLink
          aria-label="Inbox Point — открыть ответы"
          className={styles['admin-brand'] ?? ''}
          to="/manage"
        >
          <ProductLogo />
        </NavLink>
        <nav
          className={styles['admin-navigation']}
          aria-label="Разделы администратора"
        >
          {sections.map((item) => (
            <NavLink key={item.path} end to={item.path}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        {showLogout && (
          <div
            className={styles['admin-session-actions']}
            role="group"
            aria-label="Выход из управления"
          >
            <button
              className="quiet"
              disabled={pending}
              type="button"
              onClick={onLogout}
            >
              Выйти
            </button>
            <button
              className={styles['admin-session-actions__all']}
              disabled={pending}
              type="button"
              onClick={onRevokeAll}
            >
              Выйти на всех устройствах
            </button>
          </div>
        )}
      </div>
      <div className={styles['admin-page-heading']}>
        {organizationName && (
          <p className={styles['organization-name']}>{organizationName}</p>
        )}
        <h1>{section.title}</h1>
        <p className={styles['page-intro']}>{section.intro}</p>
      </div>
    </header>
  );
}
