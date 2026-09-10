import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import type { InboundEventOperationsStatus } from '@frontend/entities/operations/model/types';

export type ComponentProps = {
  inboundEvents: InboundEventOperationsStatus;
} & ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  return {};
}
