import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';

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

  return (
    <ModelScopeProvider scope={$scope}>
      {$props.text ? (
        <p
          role={$props.kind === 'error' ? 'alert' : 'status'}
          className={$class('message', $props.kind)}
        >
          {$props.text}
        </p>
      ) : null}
    </ModelScopeProvider>
  );
}
