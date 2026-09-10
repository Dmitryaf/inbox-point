import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { radioModel as $radioModel } from '@frontend/shared/lib/component-inputs';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramConnectionForm.model';
export function renderTelegramConnectionFormPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { chatLabel } = $state;
  const selectedChatId = $state.selectedChatId.value;
  const chats = $state.chats.value;
  if (!!$props.locked) {
    return null;
  }
  return (
    <>
      {chats.length ? (
        <fieldset className="setup-options" data-r-4c039fa9="">
          <legend data-r-4c039fa9="">{'Операторская группа'}</legend>
          {$renderList(chats, (chat) => (
            <label key={chat.id} data-r-4c039fa9="">
              <input
                value={chat.id}
                type="radio"
                checked={selectedChatId === chat.id}
                onChange={$radioModel($state, 'selectedChatId', chat.id)}
                data-r-4c039fa9=""
              />
              <span data-r-4c039fa9="">{chatLabel(chat)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </>
  );
}
