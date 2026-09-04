import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';
import { invokeHandler as $invoke } from '@manage/shared/lib/component-events';

import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

import { renderCustomSectionsEditorPart1 } from './CustomSectionsEditor.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './CustomSectionsEditor.model';

export default function CustomSectionsEditor($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { add } = $state;
  const sections = $state.sections.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        className={$class('card', $attributes.className)}
      >
        <div className="section-heading">
          <div>
            <p className="step">{'Свои кнопки'}</p>
            <h2>{'Дополнительные разделы'}</h2>
          </div>
          <span>
            {sections.length}
            {' / 6'}
          </span>
        </div>
        {sections.length === 0 ? (
          <p className="empty">{' Дополнительных разделов пока нет. '}</p>
        ) : null}
        {renderCustomSectionsEditorPart1($state)}
        <button
          disabled={sections.length >= 6}
          type="button"
          onClick={($event) => {
            $invoke(add, $event);
          }}
        >
          {' Добавить раздел '}
        </button>
      </section>
    </ModelScopeProvider>
  );
}
