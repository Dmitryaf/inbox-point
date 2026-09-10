import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed, ref } from '@frontend/shared/lib/model-state';
import type { ChannelSetupStatus } from '@frontend/entities/setup/model/types';
import { useVkSetup } from '@frontend/features/setup-vk/model/use-vk-setup';

export type ComponentProps = {
  status: ChannelSetupStatus;
  telegramConnected: boolean;
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
  const {
    accessToken,
    community,
    connect,
    disconnect,
    disconnecting,
    message,
    messageKind,
    pending,
  } = useVkSetup(
    () => emit('connected'),
    () => emit('disconnected'),
  );
  const toggleLabel = computed(() => {
    if (!props.telegramConnected && !props.status.connected) {
      return 'Сначала Telegram';
    }
    if (expanded.value) {
      return 'Скрыть';
    }
    return props.status.source !== 'none' ? 'Сведения' : 'Подключить VK';
  });
  return {
    expanded,
    accessToken,
    community,
    connect,
    disconnect,
    disconnecting,
    message,
    messageKind,
    pending,
    toggleLabel,
  };
}
