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
  errors?: Readonly<Record<string, string | undefined>>;
} & {
  modelValue: CustomSection[];
  onModelValueChange?: (value: CustomSection[]) => void;
} & ComponentAttributes;
export const componentDefaults = { errors: () => ({}) };
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  _emit: (event: string, ...args: unknown[]) => void,
  $model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
) {
  const sections = $model<CustomSection[]>('modelValue', { required: true });
  function add(): void {
    if (sections.value.length < 6) {
      sections.value.push({ label: '', text: '' });
    }
  }
  function move(index: number, offset: -1 | 1): void {
    const target = index + offset;
    if (target < 0 || target >= sections.value.length) {
      return;
    }
    const [section] = sections.value.splice(index, 1);
    if (section) {
      sections.value.splice(target, 0, section);
    }
  }
  return { sections, add, move };
}
