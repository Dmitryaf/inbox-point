<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';
import SaveBar from '@frontend/features/save-content/ui/SaveBar.vue';
import ContentSummary from '@frontend/entities/content/ui/ContentSummary.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';
import ChangeHistory from '@frontend/widgets/change-history/ui/ChangeHistory.vue';
import ContentEditor from '@frontend/widgets/content-editor/ui/ContentEditor.vue';
import ContentPreview from '@frontend/widgets/content-preview/ui/ContentPreview.vue';
import type {
  EditorSection,
  WorkspaceView,
} from '@frontend/widgets/content-workspace/model/navigation';
import { useContentWorkspace } from '@frontend/widgets/content-workspace/model/use-content-workspace';
import WorkspaceNavigation from './WorkspaceNavigation.vue';

const props = defineProps<{ authenticated: boolean }>();
const emit = defineEmits<{
  dirtyChange: [dirty: boolean];
  unauthorized: [];
}>();
const workspace = useContentWorkspace({
  onUnauthorized: () => emit('unauthorized'),
});
const activeView = ref<WorkspaceView>('edit');
const activeSection = ref<EditorSection>('core');
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
</script>

<template>
  <AsyncMessage kind="error" :text="workspace.error.value" />
  <AsyncMessage kind="success" :text="workspace.notice.value" />
  <p v-if="workspace.loading.value" class="state-card card" role="status">
    Загружаем информацию…
  </p>
  <section v-else-if="!workspace.loaded.value" class="state-card card">
    <p>Редактор не открыт. Повторите загрузку.</p>
    <button class="secondary-button" type="button" @click="workspace.load">
      Повторить
    </button>
  </section>
  <div v-else class="workspace">
    <WorkspaceNavigation
      :active-section="activeSection"
      :active-view="activeView"
      @section-change="openSection"
      @view-change="activeView = $event"
    />

    <div class="workspace-main">
      <ContentSummary :content="workspace.draft" />
      <section class="workspace-panel" aria-label="Рабочая область">
        <div :key="activeView" class="workspace-view">
          <ContentEditor
            v-if="activeView === 'edit'"
            v-model="workspace.draft"
            :active-section="activeSection"
            :errors="fieldErrors"
          />
          <ContentPreview
            v-else-if="activeView === 'preview'"
            :content="workspace.draft"
          />
          <ChangeHistory
            v-else
            :changes="workspace.history.value"
            :has-unsaved-changes="workspace.dirty.value"
            :loading="workspace.historyLoading.value"
            :restoring="workspace.restoring.value"
            @restore="workspace.restore"
          />
        </div>
      </section>
      <SaveBar
        :dirty="workspace.dirty.value"
        :saving="workspace.saving.value"
        :valid="validation.valid"
        :validation-message="validation.message"
        @save="save"
      />
    </div>
  </div>
</template>

<style scoped src="../styles/content-workspace.css"></style>
