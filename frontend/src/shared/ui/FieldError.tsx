import '@frontend/shared/styles/field-error.react-data-r-7695f9a8.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './FieldError.model';

export default function FieldError($incomingProps: ComponentProps) {
  const { props: $props, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      {$props.text ? (
        <p
          {...$attributes}
          id={$props.id}
          role="alert"
          className={$class('field-error', $attributes.className)}
          data-r-7695f9a8=""
        >
          {$props.text}
        </p>
      ) : null}
    </ModelScopeProvider>
  );
}
