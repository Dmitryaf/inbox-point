import '@frontend/entities/setup/styles/setup-card.react-data-r-4c039fa9.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import TelegramSetupInstructions from './TelegramSetupInstructions';

import { renderTelegramConnectionFormPart1 } from './TelegramConnectionForm.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './TelegramConnectionForm.model';

export default function TelegramConnectionForm($incomingProps: ComponentProps) {
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
      <p className="setup-technical-note" data-r-4c039fa9="">
        {
          ' Для этой настройки нужны права владельца бота и группы, а также токен от @BotFather. Если вы отвечаете клиентам, попросите владельца подключения выполнить эти шаги. '
        }
      </p>
      <TelegramSetupInstructions data-r-4c039fa9="" />
      {renderTelegramConnectionFormPart1($state, $props)}
    </ModelScopeProvider>
  );
}
