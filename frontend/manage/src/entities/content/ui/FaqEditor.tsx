import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';
import { invokeHandler as $invoke } from '@manage/shared/lib/component-events';

import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

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
  const items = $state.items.value;
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
            {items.length}
            {' / 20'}
          </span>
        </div>
        <p>{'Вопросы показываются клиенту в этом порядке.'}</p>
        {items.length === 0 ? (
          <p className="empty">
            {' Вопросов пока нет. Клиенту предложат написать преподавателю. '}
          </p>
        ) : null}
        {renderFaqEditorPart1($state)}
        <button
          disabled={items.length >= 20}
          type="button"
          onClick={($event) => {
            $invoke(add, $event);
          }}
        >
          {' Добавить вопрос '}
        </button>
      </section>
    </ModelScopeProvider>
  );
}
