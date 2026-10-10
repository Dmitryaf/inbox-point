import '@frontend/entities/content/styles/class-editor.react-data-r-13661f32.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { modelSetter as $setter } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import ClassDirectionEditor from './ClassDirectionEditor';
import ClassKeywordsEditor from './ClassKeywordsEditor';

import { renderClassScheduleEditorPart1 } from './ClassScheduleEditor.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassScheduleEditor.model';

export default function ClassScheduleEditor($incomingProps: ComponentProps) {
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
  const notice = $state.notice.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-label="Направления и группы"
        className={$class('class-editor', $attributes.className)}
        data-r-13661f32=""
      >
        <h3 id="class-directions" tabIndex={-1} data-r-13661f32="">
          {'Направления и группы'}
        </h3>
        <p data-r-13661f32="">
          {
            ' Создайте направление, добавьте группы и укажите дни занятий. Клиент выберет группу и сможет оставить заявку. '
          }
        </p>
        {$renderList(draft.directions, (direction) => (
          <ClassDirectionEditor
            key={direction.id}
            directionId={direction.id}
            modelValue={draft}
            onModelValueChange={$setter($state, 'draft')}
            data-r-13661f32=""
          />
        ))}
        <label htmlFor="new-direction-name" data-r-13661f32="">
          {'Новое направление'}
        </label>
        {renderClassScheduleEditorPart1($state)}
        {notice ? (
          <p role="status" data-r-13661f32="">
            {notice}
          </p>
        ) : null}
        <ClassKeywordsEditor
          modelValue={draft}
          onModelValueChange={$setter($state, 'draft')}
          data-r-13661f32=""
        />
      </section>
    </ModelScopeProvider>
  );
}
