import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { onMounted, ref, watch } from '@frontend/shared/lib/model-state';

import type { EditorSection, WorkspaceView } from '../model/navigation';
import { useContentWorkspace } from '../model/use-content-workspace';

export type ComponentProps = EventProps<{
  dirtyChange: [dirty: boolean];
  unauthorized: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  _props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const emit = $emit;
  const workspace = useContentWorkspace({
    onUnauthorized: () => emit('unauthorized'),
  });
  const activeView = ref<WorkspaceView>('edit');
  const activeSection = ref<EditorSection>('core');
  onMounted(() => void workspace.load());
  watch(workspace.dirty, (dirty) => emit('dirtyChange', dirty), {
    immediate: true,
  });
  return { workspace, activeView, activeSection };
}
