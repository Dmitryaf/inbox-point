import '@frontend/entities/content/styles/core-sections-fields.react-data-r-54db50dd.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { modelSetter as $setter } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import ScheduleEditor from '@frontend/entities/content/ui/ScheduleEditor';

import { renderCoreSectionsFieldsPart1 } from './CoreSectionsFields.part1';
import { renderCoreSectionsFieldsPart2 } from './CoreSectionsFields.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './CoreSectionsFields.model';

export default function CoreSectionsFields($incomingProps: ComponentProps) {
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
        className={$class('card', $attributes.className)}
        data-r-54db50dd=""
      >
        <h2 data-r-54db50dd="">{'Основные ответы'}</h2>
        <ScheduleEditor
          errors={$props.errors}
          modelValue={draft}
          onModelValueChange={$setter($state, 'draft')}
          data-r-54db50dd=""
        />
        {renderCoreSectionsFieldsPart1($state, $props)}
        {renderCoreSectionsFieldsPart2($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
