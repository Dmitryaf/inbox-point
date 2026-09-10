import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { RouterLink } from '@frontend/shared/lib/router';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './AdminPageHeader.model';
export function renderAdminPageHeaderPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;
  const sections = $unref($state.sections);

  return (
    <>
      <div className="admin-topbar" data-r-e15afcb7="">
        <RouterLink to="/manage" className="admin-brand" data-r-e15afcb7="">
          {' Inbox Point '}
        </RouterLink>
        <nav
          aria-label="Разделы администратора"
          className="admin-navigation"
          data-r-e15afcb7=""
        >
          {$renderList(sections, (section) => (
            <RouterLink
              key={section.id}
              aria-current={$props.current === section.id ? 'page' : undefined}
              to={section.href}
              data-r-e15afcb7=""
            >
              {section.label}
            </RouterLink>
          ))}
        </nav>
        {$props.showLogout ? (
          <button
            type="button"
            onClick={() => void $emit('logout')}
            className="quiet admin-logout"
            data-r-e15afcb7=""
          >
            {' Выйти '}
          </button>
        ) : null}
      </div>
    </>
  );
}
