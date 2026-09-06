import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { radioModel as $radioModel } from '@frontend/shared/lib/component-inputs';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart3(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { chatLabel } = $state;
  const selectedChatId = $state.selectedChatId.value;
  const chats = $state.chats.value;
  if (!!$props.status.connected) {
    return null;
  }
  if (!!$props.status.locked) {
    return null;
  }
  return (
    <>
      {chats.length ? (
        <fieldset className="setup-options">
          <legend>{'Операторская группа'}</legend>
          {$renderList(chats, (chat) => (
            <label key={chat.id}>
              <input
                value={chat.id}
                type="radio"
                checked={selectedChatId === chat.id}
                onChange={$radioModel($state, 'selectedChatId', chat.id)}
              />
              <span>{chatLabel(chat)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </>
  );
}
