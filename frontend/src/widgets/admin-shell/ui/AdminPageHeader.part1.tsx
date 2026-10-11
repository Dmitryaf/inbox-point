import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import ProductLogo from '@frontend/shared/ui/ProductLogo';

import { RouterLink } from '@frontend/shared/lib/router';

import { renderAdminPageHeaderPart2 } from './AdminPageHeader.part2';

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
  const sections = $unref($state.sections);

  return (
    <>
      <div className="admin-topbar" data-r-e15afcb7="">
        <RouterLink
          aria-label="Inbox Point — открыть ответы"
          to="/manage"
          className="admin-brand"
          data-r-e15afcb7=""
        >
          <ProductLogo data-r-e15afcb7="" />
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
        {renderAdminPageHeaderPart2($state, $props)}
      </div>
    </>
  );
}
