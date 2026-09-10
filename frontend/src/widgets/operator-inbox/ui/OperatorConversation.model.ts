import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { ref } from '@frontend/shared/lib/model-state';
import type {
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  actionPending: boolean;
  messages: readonly OperatorInboxMessage[];
  onClose: () => Promise<void>;
  onReply: (text: string) => Promise<boolean>;
  request: OperatorInboxRequest;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const replyText = ref('');
  async function submitReply(): Promise<void> {
    if (await props.onReply(replyText.value)) {
      replyText.value = '';
    }
  }
  async function closeRequest(): Promise<void> {
    if (
      window.confirm(
        'Закрыть обращение? Следующее новое сообщение создаст новое обращение.',
      )
    ) {
      await props.onClose();
    }
  }
  function deliveryLabel(message: OperatorInboxMessage): string | undefined {
    if (message.deliveryStatus === 'sent') {
      return 'Доставлен';
    }
    if (message.deliveryStatus === 'pending') {
      return 'Готовится к отправке';
    }
    if (message.deliveryStatus === 'failed') {
      return message.deliveryOutcomeUnknown
        ? 'Нужно проверить доставку'
        : 'Не доставлен';
    }
    return undefined;
  }
  return { replyText, submitReply, closeRequest, deliveryLabel };
}
