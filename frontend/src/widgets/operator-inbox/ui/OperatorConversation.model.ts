import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import type {
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  actionPending: boolean;
  messages: readonly OperatorInboxMessage[];
  messagesLoading: boolean;
  messagesError: string;
  messagesReady: boolean;
  draft: string;
  onClose: () => Promise<void>;
  onReply: (text: string) => Promise<boolean>;
  request: OperatorInboxRequest;
} & EventProps<{
  draft: [requestId: string, text: string];
  retry: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const emit = $emit;
  const replyText = computed({
    get: () => props.draft,
    set: (text: string) => emit('draft', props.request.id, text),
  });
  async function submitReply(): Promise<void> {
    await props.onReply(replyText.value);
  }
  async function closeRequest(): Promise<void> {
    if (
      window.confirm(
        'Закрыть обращение? Чтобы обратиться снова, клиенту нужно будет выбрать «Задать вопрос» и написать сообщение.',
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
  return { emit, replyText, submitReply, closeRequest, deliveryLabel };
}
