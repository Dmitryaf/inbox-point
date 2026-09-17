import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

export type ComponentProps = {
  compact?: boolean;
  connected?: boolean;
} & ComponentAttributes;
export const componentDefaults = {
  compact: false,
  connected: false,
};

export function createComponentModel() {
  return {};
}
