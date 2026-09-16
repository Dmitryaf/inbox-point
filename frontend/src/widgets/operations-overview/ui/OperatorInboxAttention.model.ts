import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

export type ComponentProps = {
  activeRequests: number;
} & ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  return {};
}
