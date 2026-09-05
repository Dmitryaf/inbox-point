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
      >
        <div className="section-heading">
          <div>
            <p className="step">{'Готовый раздел меню'}</p>
            <h2>{'Частые вопросы'}</h2>
          </div>
          <span>
            {draft.faq.length}
            {' / 20'}
          </span>
        </div>
        <p>{'Вопросы показываются клиенту в этом порядке.'}</p>
        <p
          aria-live="polite"
          className={$class('counter', {
            'counter--error': responseLength > 4000,
          })}
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
        />
        {draft.faq.length === 0 ? (
          <p className="empty">
            {' Вопросов пока нет. Клиенту предложат написать преподавателю. '}
          </p>
        ) : null}
        {renderFaqEditorPart1($state)}
        <button
          disabled={draft.faq.length >= 20}
          type="button"
          onClick={$nativeHandler(add)}
        >
          {' Добавить вопрос '}
        </button>
      </section>
    </ModelScopeProvider>
  );
}
