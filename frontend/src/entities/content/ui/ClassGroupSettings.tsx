import '@frontend/entities/content/styles/class-editor.react-data-r-e1399ad4.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';
import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderClassGroupSettingsPart1 } from './ClassGroupSettings.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassGroupSettings.model';

export default function ClassGroupSettings($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { $emit } = $state;
  const group = $state.group.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <details
        {...$attributes}
        className={$class('class-card', $attributes.className)}
        data-r-e1399ad4=""
      >
        <summary data-r-e1399ad4="">{'Дополнительные настройки'}</summary>
        <label htmlFor={'group-description-' + group.id} data-r-e1399ad4="">
          {'Короткое описание группы'}
        </label>
        <textarea
          id={'group-description-' + group.id}
          rows={3}
          maxLength={1000}
          value={group.description ?? ''}
          onChange={$textProperty(() => $state.group.value, 'description')}
          data-r-e1399ad4=""
        />
        <label htmlFor={'group-question-' + group.id} data-r-e1399ad4="">
          {'Что спросить после нажатия «Записаться»'}
        </label>
        <textarea
          id={'group-question-' + group.id}
          rows={2}
          maxLength={1000}
          placeholder="Как к вам обращаться и на какое занятие планируете прийти?"
          value={group.applicationQuestion ?? ''}
          onChange={$textProperty(
            () => $state.group.value,
            'applicationQuestion',
          )}
          data-r-e1399ad4=""
        />
        {!group.review ? (
          <label htmlFor={'group-direction-' + group.id} data-r-e1399ad4="">
            {'Направление'}
          </label>
        ) : null}
        {renderClassGroupSettingsPart1($state, $props)}
        <button
          type="button"
          onClick={() => void $emit('remove')}
          className="danger"
          data-r-e1399ad4=""
        >
          {' Удалить группу '}
        </button>
      </details>
    </ModelScopeProvider>
  );
}
