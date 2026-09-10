import '@frontend/widgets/content-workspace/styles/content-workspace.react-data-r-09629bd3.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import { renderContentWorkspacePart1 } from './ContentWorkspace.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentWorkspace.model';

export default function ContentWorkspace($incomingProps: ComponentProps) {
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const workspace = $unref($state.workspace);
  return (
    <ModelScopeProvider scope={$scope}>
      <AsyncMessage
        kind="error"
        text={workspace.error.value}
        data-r-09629bd3=""
      />
      <AsyncMessage
        kind="success"
        text={workspace.notice.value}
        data-r-09629bd3=""
      />
      {renderContentWorkspacePart1($state)}
    </ModelScopeProvider>
  );
}
