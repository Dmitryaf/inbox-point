import '@frontend/widgets/operations-overview/styles/incident-list.react-data-r-d17d69f5.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderDeliveryIncidentListPart1 } from './DeliveryIncidentList.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './DeliveryIncidentList.model';

export default function DeliveryIncidentList($incomingProps: ComponentProps) {
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
      {renderDeliveryIncidentListPart1($state, $props)}
    </ModelScopeProvider>
  );
}
