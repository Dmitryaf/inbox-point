import '@frontend/entities/content/styles/class-editor.react-data-r-7964e07c.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderClassKeywordsEditorPart1 } from './ClassKeywordsEditor.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassKeywordsEditor.model';

export default function ClassKeywordsEditor($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const draft = $state.draft.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-label="Переход из объявления"
        className={$class('class-card', $attributes.className)}
        data-r-7964e07c=""
      >
        <h3 data-r-7964e07c="">{'Переход из объявления'}</h3>
        <p data-r-7964e07c="">
          {' По этому слову в сообщениях бот покажет '}
          {$props.targetType === 'group'
            ? 'эту группу'
            : 'группы этого направления'}
          {
            '. Во время переписки с администратором слово остаётся обычным сообщением. '
          }
        </p>
        {renderClassKeywordsEditorPart1($state, $props)}
        <button
          type="button"
          disabled={draft.keywords.length >= 40}
          onClick={() =>
            void $required($state.draft.value).keywords.push({
              phrase: '',
              targetType: $props.targetType,
              targetId: $props.targetId,
            })
          }
          data-r-7964e07c=""
        >
          {' Добавить ключевое слово '}
        </button>
      </section>
    </ModelScopeProvider>
  );
}
