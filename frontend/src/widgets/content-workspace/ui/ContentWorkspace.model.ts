import {
  type EventProps,
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from '@frontend/shared/lib/model-state';
import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';

import type {
  EditorSection,
  WorkspaceView,
} from '@frontend/widgets/content-workspace/model/navigation';
import { useContentWorkspace } from '@frontend/widgets/content-workspace/model/use-content-workspace';

export type ComponentProps = {
  authenticated: boolean;
} & EventProps<{
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
  const previewAction = ref('main');
  function preview(action: string): void {
    previewAction.value = action;
    activeView.value = 'preview';
  }
  const validation = computed(() => validateContentDraft(workspace.draft));
  const fieldErrors = computed<Record<string, string | undefined>>(() =>
    Object.fromEntries(
      validation.value.issues.map((issue) => [issue.fieldId, issue.message]),
    ),
  );
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
  async function save(): Promise<void> {
    const issue = validation.value.issues[0];
    if (!issue) {
      await workspace.save();
      return;
    }
    activeView.value = 'edit';
    activeSection.value = issue.section;
    await nextTick();
    const field = document.getElementById(issue.fieldId);
    const details = field?.closest('details');
    if (details) {
      details.open = true;
    }
    field?.focus();
  }
  function openSection(section: EditorSection): void {
    activeSection.value = section;
    activeView.value = 'edit';
  }
  return {
    workspace,
    activeView,
    activeSection,
    previewAction,
    preview,
    validation,
    fieldErrors,
    save,
    openSection,
  };
}
