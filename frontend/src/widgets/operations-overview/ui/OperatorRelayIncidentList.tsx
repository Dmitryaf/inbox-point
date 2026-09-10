import '@frontend/widgets/operations-overview/styles/incident-list.react-data-r-e2822c38.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderOperatorRelayIncidentListPart1 } from './OperatorRelayIncidentList.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperatorRelayIncidentList.model';

export default function OperatorRelayIncidentList(
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
      {renderOperatorRelayIncidentListPart1($state, $props)}
    </ModelScopeProvider>
  );
}
