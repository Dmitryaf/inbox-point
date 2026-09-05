import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderTelegramSetupInstructionsPart1 } from './TelegramSetupInstructions.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './TelegramSetupInstructions.model';

export default function TelegramSetupInstructions(
  $incomingProps: ComponentProps,
) {
  const { scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  return (
    <ModelScopeProvider scope={$scope}>
      {renderTelegramSetupInstructionsPart1()}
      <p className="setup-warning">
        {
          ' Токен позволяет управлять ботом. Никому его не отправляйте и вводите только на этой странице. '
        }
      </p>
    </ModelScopeProvider>
  );
}
