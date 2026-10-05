import '@frontend/entities/setup/styles/setup-instructions.react-data-r-9c77fc79.css';
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
      <div className="setup-intro" data-r-9c77fc79="">
        <strong data-r-9c77fc79="">{'Что вы настраиваете'}</strong>
        <p data-r-9c77fc79="">
          {
            ' Клиенты будут писать вашему Telegram-боту. Сообщения одного клиента собираются в одной теме закрытой группы сотрудников. '
          }
        </p>
      </div>
      {renderTelegramSetupInstructionsPart1()}
      <p className="setup-warning" data-r-9c77fc79="">
        {
          ' Токен позволяет управлять ботом. Никому его не отправляйте и вводите только на этой странице. '
        }
      </p>
    </ModelScopeProvider>
  );
}
