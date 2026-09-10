import '@frontend/widgets/operations-overview/styles/incident-list.react-data-r-4b17d194.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderInboundEventIncidentListPart1 } from './InboundEventIncidentList.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './InboundEventIncidentList.model';

export default function InboundEventIncidentList(
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
      {renderInboundEventIncidentListPart1($state, $props)}
    </ModelScopeProvider>
  );
}
