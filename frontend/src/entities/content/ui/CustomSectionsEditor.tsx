import '@frontend/entities/content/styles/collection-editor.react-data-r-c3e93385.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderCustomSectionsEditorPart1 } from './CustomSectionsEditor.part1';
import { renderCustomSectionsEditorPart2 } from './CustomSectionsEditor.part2';
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
        data-r-c3e93385=""
      >
        {renderCustomSectionsEditorPart1($state)}
        {sections.length === 0 ? (
          <p className="empty" data-r-c3e93385="">
            {' Дополнительных разделов пока нет. '}
          </p>
        ) : null}
        {renderCustomSectionsEditorPart2($state, $props)}
        <button
          disabled={sections.length >= 6}
          type="button"
          onClick={$nativeHandler(add)}
          data-r-c3e93385=""
        >
          {' Добавить раздел '}
        </button>
      </section>
    </ModelScopeProvider>
  );
}
