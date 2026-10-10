import '@frontend/entities/content/styles/core-sections-fields.react-data-r-54db50dd.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

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
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-label="Основные ответы"
        className={$class('card', $attributes.className)}
        data-r-54db50dd=""
      >
        {renderCoreSectionsFieldsPart1($state, $props)}
        {renderCoreSectionsFieldsPart2($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
