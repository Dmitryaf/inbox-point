import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import type { InformationSectionId } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  contentPresent: boolean;
  section: InformationSectionId;
} & {
  modelValue: InformationSectionId[];
  onModelValueChange?: (value: InformationSectionId[]) => void;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  _emit: (event: string, ...args: unknown[]) => void,
  $model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
) {
  const visibleSections = $model<InformationSectionId[]>('modelValue', {
    required: true,
  });
  const props = $props;
  function updateVisibility(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    if (input.checked) {
      if (!visibleSections.value.includes(props.section)) {
        visibleSections.value.push(props.section);
      }
      return;
    }
    visibleSections.value = visibleSections.value.filter(
      (section) => section !== props.section,
    );
  }
  return { visibleSections, updateVisibility };
}
