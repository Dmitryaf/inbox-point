import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

export type ComponentProps = {
  recoverableRequests: number;
} & ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  return {};
}
