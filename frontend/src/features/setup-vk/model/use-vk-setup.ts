import { ref } from 'vue';

import {
  connectVk,
  disconnectVk,
} from '@frontend/entities/setup/api/setup-api';
import { errorMessage } from '@frontend/shared/lib/error-message';

export function useVkSetup(
  onConnected: () => void,
  onDisconnected: () => void,
) {
  const accessToken = ref('');
  const community = ref('');
  const disconnecting = ref(false);
  const message = ref('Выполните шаги и подключите сообщество.');
  const messageKind = ref<'error' | 'info' | 'success'>('info');
  const pending = ref(false);

  async function connect(): Promise<void> {
    pending.value = true;
    messageKind.value = 'info';
    try {
      await connectVk(accessToken.value.trim(), community.value.trim());
      accessToken.value = '';
      message.value = 'VK подключён. Настройка сохранена.';
      messageKind.value = 'success';
      onConnected();
    } catch (cause: unknown) {
      message.value = errorMessage(cause);
      messageKind.value = 'error';
    } finally {
      pending.value = false;
    }
  }

  async function disconnect(): Promise<void> {
    if (
      !window.confirm(
        'Отключить VK? Новые сообщения из сообщества перестанут появляться у оператора. История обращений сохранится.',
      )
    ) {
      return;
    }
    disconnecting.value = true;
    messageKind.value = 'info';
    try {
      await disconnectVk();
      onDisconnected();
    } catch (cause: unknown) {
      message.value = errorMessage(cause);
      messageKind.value = 'error';
    } finally {
      disconnecting.value = false;
    }
  }

  return {
    accessToken,
    community,
    connect,
    disconnect,
    disconnecting,
    message,
    messageKind,
    pending,
  };
}
