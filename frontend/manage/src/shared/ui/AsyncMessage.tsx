import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';

import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

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
          className={$class('message', $props.kind, $attributes.className)}
        >
          {$props.text}
        </p>
      ) : null}
    </ModelScopeProvider>
  );
}
