import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import type { CustomSection } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  name: string;
} & {
  modelValue?: CustomSection['mode'];
  onModelValueChange?: (value: CustomSection['mode']) => void;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  _emit: (event: string, ...args: unknown[]) => void,
  $model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
) {
  const mode = $model<CustomSection['mode']>('modelValue', {});
  const purposes = [
    {
      value: 'information',
      label: 'Показать информацию',
      description:
        'Например: «Цены», «Адрес», «Что взять с собой». Нажав кнопку, человек получит готовый ответ.',
    },
    {
      value: 'application',
      label: 'Принять заявку',
      description:
        'Например: «Заказать звонок». Бот спросит нужные детали и передаст ответ администратору.',
    },
  ] as const;
  return { mode, purposes };
}
