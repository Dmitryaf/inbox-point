import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { ref } from '@frontend/shared/lib/model-state';

import type {
  ClassDirection,
  ClassGroup,
} from '@core/application/class-content';
import { classEnrollmentIssue } from '@frontend/entities/content/model/class-enrollment';

export type ComponentProps = {
  directions: ClassDirection[];
  groups: ClassGroup[];
} & {
  modelValue: ClassGroup;
  onModelValueChange?: (value: ClassGroup) => void;
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
  const group = $model<ClassGroup>('modelValue', { required: true });
  const props = $props;
  const notice = ref('');
  function changeEnrollment(event: Event): void {
    const input = event.target as HTMLInputElement;
    notice.value = input.checked
      ? (classEnrollmentIssue(props, group.value) ?? '')
      : '';
    if (!notice.value) {
      if (input.checked) {
        delete group.value.review;
      }
      group.value.enrollmentOpen = input.checked;
    }
    input.checked = group.value.enrollmentOpen;
  }
  return { group, notice, changeEnrollment };
}
