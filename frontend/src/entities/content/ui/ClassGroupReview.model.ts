import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import { normalizeClassDraft } from '@frontend/entities/content/model/class-editor';
import { ref } from '@frontend/shared/lib/model-state';
import type {
  ClassGroup,
  ClassDirection,
} from '@core/application/class-content';
import { classContentIssue } from '@core/application/class-content';

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
  function confirm(directions: ClassDirection[]): void {
    const candidate = { ...group.value };
    delete candidate.review;
    const issue = classContentIssue(
      normalizeClassDraft({
        directions,
        groups: props.groups.map((item) =>
          item.id === candidate.id ? candidate : item,
        ),
      }),
      [],
    );
    if (issue) {
      notice.value =
        'Укажите направление, название группы и расписание. Затем подтвердите данные.';
      return;
    }
    if (
      !window.confirm(
        'Все сведения из исходной записи перенесены в поля группы?',
      )
    ) {
      return;
    }
    delete group.value.review;
    notice.value = '';
  }
  return { group, notice, confirm };
}
