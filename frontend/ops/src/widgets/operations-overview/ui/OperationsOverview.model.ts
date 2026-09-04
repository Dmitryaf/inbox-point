import {
  type ComponentAttributes,
  type WithDefaults,
} from '@ops/shared/lib/component-model';

import { computed } from '@ops/shared/lib/model-state';

import type { OperationsStatus } from '@ops/entities/operations/model/types';

export type ComponentProps = { status: OperationsStatus } & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const observedAt = computed(() =>
    new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(props.status.observedAt)),
  );
  return { observedAt };
}
