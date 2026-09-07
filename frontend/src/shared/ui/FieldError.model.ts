import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

export type ComponentProps = {
  id: string;
  text: string | undefined;
} & ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  return {};
}
