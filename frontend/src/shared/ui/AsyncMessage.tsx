import '@frontend/shared/styles/async-message.react-data-r-c8b71402.css';
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
} from './AsyncMessage.model';

export default function AsyncMessage($incomingProps: ComponentProps) {
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
          role={$props.kind === 'error' ? 'alert' : 'status'}
          className={$class('message card', $props.kind, $attributes.className)}
          data-r-c8b71402=""
        >
          {$props.text}
        </p>
      ) : null}
    </ModelScopeProvider>
  );
}
