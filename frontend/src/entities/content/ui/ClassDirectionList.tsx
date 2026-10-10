import '@frontend/entities/content/styles/class-editor.react-data-r-ec1d0881.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderClassDirectionListPart1 } from './ClassDirectionList.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassDirectionList.model';

export default function ClassDirectionList($incomingProps: ComponentProps) {
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  return (
    <ModelScopeProvider scope={$scope}>
      {renderClassDirectionListPart1($state)}
    </ModelScopeProvider>
  );
}
