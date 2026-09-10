import '@frontend/widgets/operator-inbox/styles/operator-inbox.react-data-r-ae8be5db.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import { renderOperatorInboxPart1 } from './OperatorInbox.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperatorInbox.model';

export default function OperatorInbox($incomingProps: ComponentProps) {
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const inbox = $unref($state.inbox);
  return (
    <ModelScopeProvider scope={$scope}>
      <AsyncMessage kind="error" text={inbox.error.value} data-r-ae8be5db="" />
      {renderOperatorInboxPart1($state)}
    </ModelScopeProvider>
  );
}
