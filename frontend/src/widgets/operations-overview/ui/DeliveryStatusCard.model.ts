import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';

import type { OperationsStatus } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  deliveries: OperationsStatus['deliveries'];
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const state = computed(() => {
    if (props.deliveries.state === 'failed') {
      return { label: 'Есть ошибки', tone: 'attention' };
    }
    if (props.deliveries.state === 'stalled') {
      return { label: 'Обработчик остановлен', tone: 'attention' };
    }
    if (props.deliveries.state === 'backlog') {
      return { label: 'Очередь задерживается', tone: 'attention' };
    }
    return { label: 'Работает', tone: 'healthy' };
  });
  return { state };
}
