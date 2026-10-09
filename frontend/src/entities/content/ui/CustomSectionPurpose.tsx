import '@frontend/entities/content/styles/custom-section-purpose.react-data-r-fc41a8d8.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderCustomSectionPurposePart1 } from './CustomSectionPurpose.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './CustomSectionPurpose.model';

export default function CustomSectionPurpose($incomingProps: ComponentProps) {
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
      <div
        {...$attributes}
        role="radiogroup"
        aria-labelledby={`${$props.name}-label`}
        className={$class('section-purpose', $attributes.className)}
        data-r-fc41a8d8=""
      >
        <p
          id={`${$props.name}-label`}
          className="purpose-title"
          data-r-fc41a8d8=""
        >
          {'Для чего нужна кнопка?'}
        </p>
        {renderCustomSectionPurposePart1($state, $props)}
      </div>
    </ModelScopeProvider>
  );
}
