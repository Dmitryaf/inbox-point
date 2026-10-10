import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';
import {
  type ModelOptions,
  type ModelRef,
} from '@frontend/shared/lib/component-props';
import type { ContentDraft } from '@frontend/entities/content/model/types';

import type { EditorSection } from '@frontend/widgets/content-workspace/model/navigation';

export type ComponentProps = {
  activeSection: EditorSection;
  errors: Readonly<Record<string, string | undefined>>;
} & EventProps<{
  preview: [action: string];
}> & {
    modelValue: ContentDraft;
    onModelValueChange?: (value: ContentDraft) => void;
  } & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
  $model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
) {
  const emit = $emit;
  const draft = $model<ContentDraft>('modelValue', { required: true });
  return { emit, draft };
}
