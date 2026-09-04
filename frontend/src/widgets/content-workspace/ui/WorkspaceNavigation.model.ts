import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import type {
  EditorSection,
  WorkspaceView,
} from '@frontend/widgets/content-workspace/model/navigation';
import {
  editorSections,
  workspaceViews,
} from '@frontend/widgets/content-workspace/model/navigation';

export type ComponentProps = {
  activeSection: EditorSection;
  activeView: WorkspaceView;
} & EventProps<{
  sectionChange: [section: EditorSection];
  viewChange: [view: WorkspaceView];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const emit = $emit;
  function changeView(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const view = workspaceViews.find((item) => item.id === select.value);
    if (view) {
      emit('viewChange', view.id);
    }
  }
  function changeSection(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const section = editorSections.find((item) => item.id === select.value);
    if (section) {
      emit('sectionChange', section.id);
    }
  }
  return { $emit, changeView, changeSection };
}
