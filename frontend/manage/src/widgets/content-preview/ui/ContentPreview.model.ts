import {
  type ComponentAttributes,
  type WithDefaults,
} from '@manage/shared/lib/component-model';

import { computed } from '@manage/shared/lib/model-state';
import { hasContent } from '@manage/entities/content/model/content-draft';
import type { ContentDraft } from '@manage/entities/content/model/types';

export type ComponentProps = { content: ContentDraft } & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const visible = computed(() => hasContent(props.content));
  return { visible };
}
