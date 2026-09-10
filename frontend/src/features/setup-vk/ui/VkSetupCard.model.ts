import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed, ref } from '@frontend/shared/lib/model-state';
import { connectVk } from '@frontend/entities/setup/api/setup-api';
import type { ChannelSetupStatus } from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';

export type ComponentProps = {
  status: ChannelSetupStatus;
  telegramConnected: boolean;
} & EventProps<{
  connected: [];
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
  const community = ref('');
  const accessToken = ref('');
  const message = ref('Выполните шаги и подключите сообщество.');
  const messageKind = ref<'error' | 'info' | 'success'>('info');
  const pending = ref(false);
  const expanded = ref(false);
  const toggleLabel = computed(() => {
    if (!props.telegramConnected && !props.status.connected) {
      return 'Сначала Telegram';
    }
    if (expanded.value) {
      return 'Скрыть';
    }
    return props.status.connected ? 'Сведения' : 'Подключить VK';
  });
  async function connect(): Promise<void> {
    pending.value = true;
    messageKind.value = 'info';
    try {
      await connectVk(accessToken.value.trim(), community.value.trim());
      accessToken.value = '';
      message.value = 'VK подключён. Настройка сохранена.';
      messageKind.value = 'success';
      emit('connected');
    } catch (cause: unknown) {
      message.value = errorMessage(cause);
      messageKind.value = 'error';
    } finally {
      pending.value = false;
    }
  }
  return {
    community,
    accessToken,
    message,
    messageKind,
    pending,
    expanded,
    toggleLabel,
    connect,
  };
}
