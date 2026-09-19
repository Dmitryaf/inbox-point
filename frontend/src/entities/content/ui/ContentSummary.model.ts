import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import { isSectionVisible } from '@frontend/entities/content/model/content-draft';
import { normalizeScheduleItems } from '@frontend/entities/content/lib/schedule-response';
import type { ContentDraft } from '@frontend/entities/content/model/types';

export type ComponentProps = {
  content: ContentDraft;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const standardCount = computed(() => {
    const sections = [
      isSectionVisible(props.content, 'schedule') &&
        (normalizeScheduleItems(props.content.schedule).length > 0 ||
          props.content.legacySchedule.trim()),
      isSectionVisible(props.content, 'prices') && props.content.prices.trim(),
      isSectionVisible(props.content, 'address') &&
        props.content.address.trim(),
      isSectionVisible(props.content, 'faq') && props.content.faq.length > 0,
    ];
    return sections.filter(Boolean).length;
  });
  const totalCount = computed(
    () => standardCount.value + props.content.customSections.length,
  );
  return { standardCount, totalCount };
}
