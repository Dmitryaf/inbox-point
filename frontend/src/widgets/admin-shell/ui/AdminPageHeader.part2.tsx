import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './AdminPageHeader.model';
export function renderAdminPageHeaderPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const sections = $unref($state.sections);

  return (
    <>
      {$props.authenticated ? (
        <nav
          aria-label="Разделы администратора"
          className="admin-navigation"
          data-r-e15afcb7=""
        >
          {$renderList(sections, (section) => (
            <a
              key={section.id}
              aria-current={$props.current === section.id ? 'page' : undefined}
              href={section.href}
              data-r-e15afcb7=""
            >
              {section.label}
            </a>
          ))}
        </nav>
      ) : null}
    </>
  );
}
