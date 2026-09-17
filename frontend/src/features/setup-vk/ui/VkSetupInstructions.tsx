import '@frontend/entities/setup/styles/setup-instructions.react-data-r-aa9e848d.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderVkSetupInstructionsPart1 } from './VkSetupInstructions.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './VkSetupInstructions.model';

export default function VkSetupInstructions($incomingProps: ComponentProps) {
  const { props: $props, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  return (
    <ModelScopeProvider scope={$scope}>
      {renderVkSetupInstructionsPart1($props)}
    </ModelScopeProvider>
  );
}
