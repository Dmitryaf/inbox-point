import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';

import { unref as $unref } from '@manage/shared/lib/model-state';

import AsyncMessage from '@manage/shared/ui/AsyncMessage';

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
      <AsyncMessage kind="error" text={workspace.error.value} />
      <AsyncMessage kind="success" text={workspace.notice.value} />
      {renderContentWorkspacePart1($state)}
    </ModelScopeProvider>
  );
}
