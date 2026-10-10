import '@frontend/entities/content/styles/class-editor.react-data-r-92fb3f88.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderLegacyScheduleAssignmentPart1 } from './LegacyScheduleAssignment.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './LegacyScheduleAssignment.model';

export default function LegacyScheduleAssignment(
  $incomingProps: ComponentProps,
) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  return (
    <ModelScopeProvider scope={$scope}>
      {renderLegacyScheduleAssignmentPart1($state, $props)}
    </ModelScopeProvider>
  );
}
