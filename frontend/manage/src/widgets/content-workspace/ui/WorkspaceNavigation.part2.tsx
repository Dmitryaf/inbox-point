import {
  classNames as $class,
  renderList as $renderList,
} from '@manage/shared/lib/component-view';

import { unref as $unref } from '@manage/shared/lib/model-state';

import { editorSections } from '@manage/widgets/content-workspace/model/navigation';

import type { WithDefaults } from '@manage/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './WorkspaceNavigation.model';
export function renderWorkspaceNavigationPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;
  return (
    <>
      {$props.activeView === 'edit' ? (
        <nav
          aria-label="Разделы информации"
          className="editor-navigation desktop-editor-navigation"
        >
          {$renderList($unref(editorSections), (section) => (
            <button
              key={section.id}
              aria-pressed={$props.activeSection === section.id}
              type="button"
              onClick={() => {
                void $emit('sectionChange', section.id);
              }}
              className={$class(
                { active: $props.activeSection === section.id },
                'section-button',
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>
      ) : null}
    </>
  );
}
