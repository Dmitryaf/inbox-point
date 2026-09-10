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
    if (channelIsPaused) {
      return channel === 'telegram'
        ? 'Бот не передаёт новые обращения оператору и сообщает клиенту о паузе.'
        : 'Новые сообщения остаются в VK, но не появляются у оператора.';
    }
    if (channel === 'telegram') {
      return 'Новый вопрос можно задать через бота.';
    }
    return 'Новый вопрос можно задать через сообщество.';
  }
  return { $emit, channelName, pauseExplanation };
}
