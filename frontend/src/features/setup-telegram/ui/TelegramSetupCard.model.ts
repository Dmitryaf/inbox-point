import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { ref } from '@frontend/shared/lib/model-state';
import { disconnectTelegram } from '@frontend/entities/setup/api/setup-api';
import type { ChannelSetupStatus } from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';

export type ComponentProps = {
  status: ChannelSetupStatus;
  vkConfigured: boolean;
} & EventProps<{
  connected: [];
  disconnected: [];
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
  const expanded = ref(false);
  const disconnectError = ref('');
  const disconnecting = ref(false);
  async function disconnect(): Promise<void> {
    if (
      props.vkConfigured ||
      !window.confirm(
        'Отключить Telegram? Приложение перестанет получать сообщения из бота и передавать обращения в группу администраторов. История обращений сохранится.',
      )
    ) {
      return;
    }
    disconnecting.value = true;
    disconnectError.value = '';
    try {
      await disconnectTelegram();
      emit('disconnected');
    } catch (cause: unknown) {
      disconnectError.value = errorMessage(cause);
    } finally {
      disconnecting.value = false;
    }
  }
  return { $emit, expanded, disconnectError, disconnecting, disconnect };
}
