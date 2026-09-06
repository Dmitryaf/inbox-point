import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import { renderOperatorInboxPart1 } from './OperatorInbox.part1';
import { renderOperatorInboxPart2 } from './OperatorInbox.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperatorInbox.model';

export default function OperatorInbox($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const inbox = $unref($state.inbox);
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="operator-inbox-title"
        className={$class('card operator-inbox', $attributes.className)}
      >
        {renderOperatorInboxPart1($state)}
        <AsyncMessage kind="error" text={inbox.error.value} />
        <AsyncMessage kind="success" text={inbox.notice.value} />
        {renderOperatorInboxPart2($state)}
      </section>
    </ModelScopeProvider>
  );
}
