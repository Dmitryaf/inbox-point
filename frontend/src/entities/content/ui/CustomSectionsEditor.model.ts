import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { useCollectionEditor } from '@frontend/entities/content/lib/use-collection-editor';
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
  const { add, move, remove, itemKey } = useCollectionEditor({
    items: () => sections.value,
    create: () => ({ label: '', text: '' }),
    limit: 6,
    fieldPrefix: 'section-label',
    description: (item, index) => `раздел «${item.label.trim() || index + 1}»`,
    hasContent: (item) => !!(item.label.trim() || item.text.trim()),
  });
  return { sections, add, move, remove, itemKey };
}
