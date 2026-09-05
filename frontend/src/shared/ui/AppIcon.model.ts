import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

export type AppIconName =
  | 'channel'
  | 'check'
  | 'core'
  | 'custom'
  | 'edit'
  | 'faq'
  | 'history'
  | 'preview';
export type ComponentProps = { name: AppIconName } & ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  return {};
}
