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
    if (props.channel.state === 'not_configured') {
      return { label: 'Не настроен', tone: 'neutral' };
    }
    if (props.channel.state === 'poll_failed') {
      return { label: 'Ошибка связи', tone: 'attention' };
    }
    if (props.channel.state === 'poll_stale') {
      return { label: 'Нет свежих данных', tone: 'attention' };
    }
    if (props.channel.state === 'running') {
      return { label: 'Запущен', tone: 'healthy' };
    }
    if (props.channel.state === 'starting') {
      return { label: 'Запускается', tone: 'neutral' };
    }
    return { label: 'Остановлен', tone: 'attention' };
  });
  return { state };
}
