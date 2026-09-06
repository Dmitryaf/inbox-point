import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type { OperatorInboxRequest } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  requests: readonly OperatorInboxRequest[];
  selectedRequestId: string;
} & EventProps<{
  select: [requestId: string];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  function formatDate(value: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }
  function channelName(channel: 'telegram' | 'vk'): string {
    return channel === 'telegram' ? 'Telegram' : 'VK';
  }
  return { $emit, formatDate, channelName };
}
