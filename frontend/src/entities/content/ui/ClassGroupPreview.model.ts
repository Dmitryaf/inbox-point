import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed, ref } from '@frontend/shared/lib/model-state';
import { renderClassAction } from '@core/application/class-navigation';
import { previewClassInformation } from '@frontend/entities/content/lib/class-preview';
import type { ContentDraft } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  content: ContentDraft;
  groupId: string;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const operation = ref('group');
  const response = computed(() => {
    return renderClassAction(
      previewClassInformation(props.content),
      `classes:${operation.value}:${props.groupId}`,
    );
  });
  function select(action: string): void {
    const next = action.split(':')[1];
    if (
      ['group', 'times', 'signup', 'prices', 'question'].includes(next ?? '')
    ) {
      operation.value = next!;
    }
  }
  return { response, select };
}
