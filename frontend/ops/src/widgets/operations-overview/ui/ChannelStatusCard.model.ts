import {
  type ComponentAttributes,
  type WithDefaults,
} from '@ops/shared/lib/component-model';

import { computed } from '@ops/shared/lib/model-state';

import type { ChannelOperationsStatus } from '@ops/entities/operations/model/types';

export type ComponentProps = {
  channel: ChannelOperationsStatus;
  name: string;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const state = computed(() => {
    if (!props.channel.configured) {
      return { label: 'Не настроен', tone: 'neutral' };
    }
    if (props.channel.running) {
      return { label: 'Запущен', tone: 'healthy' };
    }
    return { label: 'Остановлен', tone: 'attention' };
  });
  return { state };
}
