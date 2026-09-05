import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { ref } from '@frontend/shared/lib/model-state';
import { connectVk } from '@frontend/entities/setup/api/setup-api';
import type { ChannelSetupStatus } from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';

export type ComponentProps = {
  status: ChannelSetupStatus;
  telegramConnected: boolean;
} & EventProps<{ connected: [] }> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const emit = $emit;
  const community = ref('');
  const accessToken = ref('');
  const message = ref('Выполните шаги и подключите сообщество.');
  const pending = ref(false);
  async function connect(): Promise<void> {
    pending.value = true;
    try {
      await connectVk(accessToken.value.trim(), community.value.trim());
      accessToken.value = '';
      message.value = 'VK подключён. Настройка сохранена.';
      emit('connected');
    } catch (cause: unknown) {
      message.value = errorMessage(cause);
    } finally {
      pending.value = false;
    }
  }
  return { community, accessToken, message, pending, connect };
}
