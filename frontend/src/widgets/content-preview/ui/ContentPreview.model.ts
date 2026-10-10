import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type { ContentDraft } from '@frontend/entities/content/model/types';
import { useContentPreview } from '@frontend/widgets/content-preview/model/use-content-preview';

export type ComponentProps = {
  content: ContentDraft;
  startAction?: string;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const { action, response, buttonRows, empty } = useContentPreview(props);
  return { action, response, buttonRows, empty };
}
