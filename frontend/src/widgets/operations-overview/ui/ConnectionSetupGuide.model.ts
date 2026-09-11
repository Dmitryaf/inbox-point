import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

export type ComponentProps = {
  problems: readonly {
    action: string;
    channel: 'Telegram' | 'VK';
  }[];
} & ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  return {};
}
