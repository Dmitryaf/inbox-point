<script setup lang="ts">
import type {
  EditorSection,
  WorkspaceView,
} from '@frontend/widgets/content-workspace/model/navigation';
import {
  editorSections,
  workspaceViews,
} from '@frontend/widgets/content-workspace/model/navigation';
import AppIcon from '@frontend/shared/ui/AppIcon.vue';

defineProps<{
  activeSection: EditorSection;
  activeView: WorkspaceView;
}>();
const emit = defineEmits<{
  sectionChange: [section: EditorSection];
  viewChange: [view: WorkspaceView];
}>();

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
</script>

<template>
  <div class="mobile-workspace-navigation">
    <div class="mobile-navigation-field">
      <label for="workspace-view">Режим</label>
      <select id="workspace-view" :value="activeView" @change="changeView">
        <option v-for="view in workspaceViews" :key="view.id" :value="view.id">
          {{ view.label }}
        </option>
      </select>
    </div>
    <div v-if="activeView === 'edit'" class="mobile-navigation-field">
      <label for="editor-section">Раздел</label>
      <select
        id="editor-section"
        :value="activeSection"
        @change="changeSection"
      >
        <option
          v-for="section in editorSections"
          :key="section.id"
          :value="section.id"
        >
          {{ section.label }}
        </option>
      </select>
    </div>
  </div>

  <aside class="dashboard-sidebar desktop-workspace-navigation">
    <nav class="sidebar-group" aria-label="Разделы управления">
      <p>Работа с информацией</p>
      <button
        v-for="view in workspaceViews"
        :key="view.id"
        :aria-pressed="activeView === view.id"
        :class="{ active: activeView === view.id }"
        class="navigation-button"
        type="button"
        @click="$emit('viewChange', view.id)"
      >
        <AppIcon :name="view.id" />
        {{ view.label }}
      </button>
    </nav>

    <nav
      v-if="activeView === 'edit'"
      class="sidebar-group"
      aria-label="Разделы информации"
    >
      <p>Разделы</p>
      <button
        v-for="section in editorSections"
        :key="section.id"
        :aria-pressed="activeSection === section.id"
        :class="{ active: activeSection === section.id }"
        class="section-button"
        type="button"
        @click="$emit('sectionChange', section.id)"
      >
        <AppIcon :name="section.id" />
        {{ section.label }}
      </button>
    </nav>
  </aside>
</template>

<style scoped src="../styles/workspace-navigation.css"></style>
