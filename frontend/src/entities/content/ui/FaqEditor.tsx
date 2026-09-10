import '@frontend/entities/content/styles/collection-editor.react-data-r-0b16243c.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { propertySetter as $propertySetter } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import SectionVisibilityControl from './SectionVisibilityControl';

import { renderFaqEditorPart1 } from './FaqEditor.part1';
import { renderFaqEditorPart2 } from './FaqEditor.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './FaqEditor.model';

export default function FaqEditor($incomingProps: ComponentProps) {
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
  const draft = $state.draft.value;
  const responseLength = $state.responseLength.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        className={$class('card', $attributes.className)}
        data-r-0b16243c=""
      >
        {renderFaqEditorPart1($state)}
        <p data-r-0b16243c="">{'Вопросы показываются в этом порядке.'}</p>
        <p
          aria-live="polite"
          className={$class('counter', {
            'counter--error': responseLength > 4000,
          })}
          data-r-0b16243c=""
        >
          {' Итоговый ответ: '}
          {responseLength}
          {' / 4000 '}
        </p>
        <SectionVisibilityControl
          contentPresent={draft.faq.length > 0}
          section="faq"
          modelValue={draft.visibleSections}
          onModelValueChange={$propertySetter(
            () => $state.draft.value,
            'visibleSections',
          )}
          data-r-0b16243c=""
        />
        {draft.faq.length === 0 ? (
          <p className="empty" data-r-0b16243c="">
            {
              ' Добавьте хотя бы один вопрос и ответ, чтобы показать этот раздел. '
            }
          </p>
        ) : null}
        {renderFaqEditorPart2($state, $props)}
        <button
          disabled={draft.faq.length >= 20}
          type="button"
          onClick={$nativeHandler(add)}
          data-r-0b16243c=""
        >
          {' Добавить вопрос '}
        </button>
      </section>
    </ModelScopeProvider>
  );
}
