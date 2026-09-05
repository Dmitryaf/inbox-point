import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import {
  computed,
  onMounted,
  ref,
  watch,
} from '@frontend/shared/lib/model-state';
import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';

import type { EditorSection, WorkspaceView } from '../model/navigation';
import { useContentWorkspace } from '../model/use-content-workspace';

export type ComponentProps = { authenticated: boolean } & EventProps<{
  dirtyChange: [dirty: boolean];
  unauthorized: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel(
  $props: ResolvedProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const props = $props;
  const emit = $emit;
  const workspace = useContentWorkspace({
    onUnauthorized: () => emit('unauthorized'),
  });
  const activeView = ref<WorkspaceView>('edit');
  const activeSection = ref<EditorSection>('core');
  const validation = computed(() => validateContentDraft(workspace.draft));
  onMounted(() => void workspace.load());
  watch(
    () => props.authenticated,
    (authenticated, previous) => {
      if (authenticated && previous === false) {
        void workspace.resumeAfterAuthentication();
      }
    },
  );
  watch(workspace.dirty, (dirty) => emit('dirtyChange', dirty), {
    immediate: true,
  });
  return { workspace, activeView, activeSection, validation };
}
