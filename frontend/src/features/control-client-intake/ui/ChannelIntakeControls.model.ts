import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type {
  ClientChannel,
  ServiceControlState,
} from '@frontend/entities/service-control/model/types';

export type ComponentProps = {
  pendingChannel: ClientChannel | undefined;
  state: ServiceControlState;
} & EventProps<{
  change: [channel: ClientChannel, mode: 'active' | 'paused'];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  function channelName(channel: ClientChannel): string {
    return channel === 'telegram' ? 'Telegram' : 'VK';
  }
  function pauseExplanation(channel: ClientChannel): string {
    const channelIsPaused = props.state.channels[channel].mode === 'paused';
    if (channel === 'telegram') {
      if (channelIsPaused) {
        return 'Бот не принимает новые обращения и предлагает посмотреть контакт в описании.';
      }
      return 'Клиенты могут начать новый разговор через бота.';
    }
    if (channelIsPaused) {
      return 'Сообщения остаются в сообществе и не передаются в Telegram.';
    }
    return 'Новые сообщения передаются преподавателю.';
  }
  return { $emit, channelName, pauseExplanation };
}
