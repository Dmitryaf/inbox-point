import '@frontend/widgets/operations-overview/styles/operations-attention-panel.react-data-r-a910a991.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderOperationsAttentionPanelPart1 } from './OperationsAttentionPanel.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperationsAttentionPanel.model';

export default function OperationsAttentionPanel(
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
      {renderOperationsAttentionPanelPart1($state, $props)}
    </ModelScopeProvider>
  );
}
