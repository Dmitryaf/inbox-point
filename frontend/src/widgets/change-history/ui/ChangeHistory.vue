<script setup lang="ts">
import type { ContentChange } from '@frontend/entities/content/model/types';
import {
  formatChangeDate,
  formatSections,
} from '@frontend/features/restore-content/model/history-format';
import RestoreAction from '@frontend/features/restore-content/ui/RestoreAction.vue';

defineProps<{
  changes: ContentChange[];
  hasUnsavedChanges: boolean;
  loading: boolean;
  restoring: boolean;
}>();
defineEmits<{ restore: [revision: number] }>();
</script>

<template>
  <section class="card" aria-labelledby="history-title">
    <p class="step">История</p>
    <h2 id="history-title">Предыдущие версии</h2>
    <p v-if="loading" class="empty" role="status">Обновляем историю…</p>
    <p v-else-if="changes.length === 0" class="empty">Изменений пока нет.</p>
    <ol v-else class="history-list">
      <li
        v-for="(change, index) in changes"
        :key="`${change.changedAt}-${change.revision ?? 'old'}`"
      >
        <strong>{{ formatChangeDate(change.changedAt) }}</strong>
        <span>{{ formatSections(change.sections) }}</span>
        <small v-if="index === 0">Текущая версия</small>
        <RestoreAction
          v-else-if="change.revision"
          :has-unsaved-changes="hasUnsavedChanges"
          :pending="restoring"
          :revision="change.revision"
          @restore="$emit('restore', $event)"
        />
        <small v-else>Старая запись: восстановление недоступно</small>
      </li>
    </ol>
  </section>
</template>

<style scoped src="../styles/change-history.css"></style>
