import {
  type EventProps,
  type ComponentAttributes,
} from '@manage/shared/lib/component-model';

import { onMounted, watch } from '@manage/shared/lib/model-state';

import { useContentWorkspace } from '../model/use-content-workspace';

export type ComponentProps = EventProps<{
  dirtyChange: [dirty: boolean];
  unauthorized: [];
}> &
  ComponentAttributes;
export const componentDefaults = {};
export function createComponentModel(
  $props: ComponentProps,
  $emit: (event: string, ...args: unknown[]) => void,
) {
  const emit = $emit;
  const workspace = useContentWorkspace({
    onUnauthorized: () => emit('unauthorized'),
  });
  onMounted(() => void workspace.load());
  watch(workspace.dirty, (dirty) => emit('dirtyChange', dirty), {
    immediate: true,
  });
  return { workspace };
}
