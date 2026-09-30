import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import { normalizeContentDraft } from '@frontend/entities/content/model/content-draft';
import type {
  ContentSnapshot,
  InformationSectionId,
} from '@frontend/entities/content/model/types';

export type ComponentProps = {
  snapshot: ContentSnapshot;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const content = computed(() => normalizeContentDraft(props.snapshot.content));
  function visibility(section: InformationSectionId): string {
    return content.value.visibleSections.includes(section)
      ? 'Кнопка включена'
      : 'Скрыто в меню';
  }
  return { content, visibility };
}
