import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';
import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';
import FieldError from '@frontend/shared/ui/FieldError';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OrganizationNameField.model';

export default function OrganizationNameField($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const name = $state.name.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-label="Организация"
        className={$class('card', $attributes.className)}
      >
        <label htmlFor="organization-name">{'Название организации'}</label>
        <input
          id="organization-name"
          maxLength={120}
          placeholder="Например, школа танцев"
          autoComplete="organization"
          aria-invalid={Boolean($props.error)}
          aria-describedby={
            $props.error ? 'organization-name-error' : undefined
          }
          value={name ?? ''}
          onChange={$textModel($state, 'name')}
        />
        <FieldError id="organization-name-error" text={$props.error} />
      </section>
    </ModelScopeProvider>
  );
}
