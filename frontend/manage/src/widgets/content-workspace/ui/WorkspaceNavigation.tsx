import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import {
  classNames as $class,
  renderList as $renderList,
} from '@manage/shared/lib/component-view';
import { invokeHandler as $invoke } from '@manage/shared/lib/component-events';
import { unref as $unref } from '@manage/shared/lib/model-state';

import {
  editorSections,
  workspaceViews,
} from '@manage/widgets/content-workspace/model/navigation';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './WorkspaceNavigation.model';
import { controlledChange as $controlledChange } from '@manage/shared/lib/component-input-event';

export default function WorkspaceNavigation($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { changeView, changeSection, $emit } = $state;

  return (
    <ModelScopeProvider scope={$scope}>
      <div className="mobile-workspace-navigation">
        <div className="mobile-navigation-field">
          <label htmlFor="workspace-view">{'Режим'}</label>
          <select
            id="workspace-view"
            value={$props.activeView}
            onChange={$controlledChange<HTMLSelectElement>(($event) => {
              $invoke(changeView, $event);
            })}
          >
            {$renderList($unref(workspaceViews), (view) => (
              <option key={view.id} value={view.id}>
                {view.label}
              </option>
            ))}
          </select>
        </div>
        {$props.activeView === 'edit' ? (
          <div className="mobile-navigation-field">
            <label htmlFor="editor-section">{'Раздел'}</label>
            <select
              id="editor-section"
              value={$props.activeSection}
              onChange={$controlledChange<HTMLSelectElement>(($event) => {
                $invoke(changeSection, $event);
              })}
            >
              {$renderList($unref(editorSections), (section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <nav
        aria-label="Разделы управления"
        className="workspace-navigation desktop-workspace-navigation"
      >
        {$renderList($unref(workspaceViews), (view) => (
          <button
            key={view.id}
            aria-pressed={$props.activeView === view.id}
            type="button"
            onClick={() => {
              void $emit('viewChange', view.id);
            }}
            className={$class(
              { active: $props.activeView === view.id },
              'navigation-button',
            )}
          >
            {view.label}
          </button>
        ))}
      </nav>
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
    </ModelScopeProvider>
  );
}
