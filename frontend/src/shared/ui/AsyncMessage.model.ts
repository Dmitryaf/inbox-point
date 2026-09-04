import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

export type ComponentProps = {
  kind: 'error' | 'success';
  text: string;
} & ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  return {};
}
