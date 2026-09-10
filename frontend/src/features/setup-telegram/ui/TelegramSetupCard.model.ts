import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { ref } from '@frontend/shared/lib/model-state';
import {
  connectTelegram,
  discoverTelegramChats,
} from '@frontend/entities/setup/api/setup-api';
import type {
  ChannelSetupStatus,
  TelegramOperatorChat,
} from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';

export type ComponentProps = {
  status: ChannelSetupStatus;
} & EventProps<{
  connected: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const emit = $emit;
  const botToken = ref('');
  const chats = ref<TelegramOperatorChat[]>([]);
  const selectedChatId = ref<number | null>(null);
  const message = ref('Выполните шаги ниже и найдите операторскую группу.');
  const messageKind = ref<'error' | 'info' | 'success'>('info');
  const pending = ref<'connect' | 'discover' | null>(null);
  function chatLabel(chat: TelegramOperatorChat): string {
    if (chat.isForum) {
      return chat.title;
    }
    return `${chat.title} — включите темы`;
  }
  async function discover(): Promise<void> {
    pending.value = 'discover';
    messageKind.value = 'info';
    try {
      const result = await discoverTelegramChats(botToken.value.trim());
      chats.value = result.chats;
      selectedChatId.value = null;
      message.value = result.chats.length
        ? 'Выберите операторскую группу.'
        : 'Напишите в группе сообщение и повторите поиск.';
    } catch (cause: unknown) {
      message.value = errorMessage(cause);
      messageKind.value = 'error';
    } finally {
      pending.value = null;
    }
  }
  async function connect(): Promise<void> {
    if (selectedChatId.value === null) {
      message.value = 'Выберите операторскую группу.';
      messageKind.value = 'error';
      return;
    }
    pending.value = 'connect';
    messageKind.value = 'info';
    try {
      await connectTelegram(botToken.value.trim(), selectedChatId.value);
      botToken.value = '';
      chats.value = [];
      message.value = 'Telegram подключён. Настройка сохранена.';
      messageKind.value = 'success';
      emit('connected');
    } catch (cause: unknown) {
      message.value = errorMessage(cause);
      messageKind.value = 'error';
    } finally {
      pending.value = null;
    }
  }
  return {
    botToken,
    chats,
    selectedChatId,
    message,
    messageKind,
    pending,
    chatLabel,
    discover,
    connect,
  };
}
