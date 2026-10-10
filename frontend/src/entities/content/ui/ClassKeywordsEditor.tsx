import '@frontend/entities/content/styles/class-editor.react-data-r-7964e07c.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

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
  const { add } = $state;
  const targets = $state.targets.value;
  const draft = $state.draft.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <details
        {...$attributes}
        open
        className={$class('class-card', $attributes.className)}
        data-r-7964e07c=""
      >
        <summary data-r-7964e07c="">
          <strong data-r-7964e07c="">{'Ключевые слова для постов'}</strong>
        </summary>
        <p data-r-7964e07c="">
          {
            ' Человек пишет слово в сообщения сообщества или бота и сразу видит выбранную группу или группы направления. Отдельная кнопка в главном меню не появится. '
          }
        </p>
        <p data-r-7964e07c="">
          {
            ' Например: «Бачата» → Бачата / Начинающие. Регистр и лишние пробелы не важны. В переписке с администратором и при заполнении заявки слово остаётся обычным сообщением. '
          }
        </p>
        {renderClassKeywordsEditorPart1($state)}
        <button
          type="button"
          disabled={$or(!targets.length, () => draft.keywords.length >= 40)}
          onClick={$nativeHandler(add)}
          data-r-7964e07c=""
        >
          {' Добавить ключевое слово '}
        </button>
        {!targets.length ? (
          <p data-r-7964e07c="">{'Сначала добавьте направление или группу.'}</p>
        ) : null}
      </details>
    </ModelScopeProvider>
  );
}
