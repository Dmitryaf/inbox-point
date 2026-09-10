import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';
import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperatorConversation.model';
export function renderOperatorConversationPart3(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { submitReply } = $state;
  const replyText = $state.replyText.value;

  return (
    <>
      <form
        onSubmit={$nativeHandler(submitReply, { prevent: true })}
        className="operator-reply-form"
        data-r-e21483db=""
      >
        <label htmlFor="operator-reply" data-r-e21483db="">
          {'Ответ'}
        </label>
        <textarea
          id="operator-reply"
          maxLength={4000}
          required
          rows={4}
          disabled={$props.actionPending}
          value={replyText ?? ''}
          onChange={$textModel($state, 'replyText')}
          data-r-e21483db=""
        />
        <div className="operator-reply-actions" data-r-e21483db="">
          <span data-r-e21483db="">
            {replyText.length}
            {' / 4000'}
          </span>
          <button
            type="submit"
            disabled={$or($props.actionPending, () => !replyText.trim())}
            data-r-e21483db=""
          >
            {$props.actionPending ? 'Готовим к отправке…' : 'Отправить'}
          </button>
        </div>
      </form>
    </>
  );
}
