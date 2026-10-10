<script setup lang="ts">
import { computed } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { removeClassGroup } from '@frontend/entities/content/model/class-editor';
import ClassEnrollmentSettings from './ClassEnrollmentSettings.vue';
import ClassGroupReview from './ClassGroupReview.vue';
import ClassGroupSettings from './ClassGroupSettings.vue';
import ClassKeywordsEditor from './ClassKeywordsEditor.vue';
const draft = defineModel<ContentDraft>({ required: true });
const props = defineProps<{ groupId: string }>();
const emit = defineEmits<{
  openTarget: [type: 'direction' | 'group', id: string];
  removed: [];
  preview: [action: string];
}>();
const group = computed(() =>
  draft.value.groups.find((item) => item.id === props.groupId),
);
const schedule = computed({
  get: () => group.value?.meetings.join('\n') ?? '',
  set: (value: string) => {
    if (group.value) {
      group.value.meetings = value.split(/\r?\n/u);
    }
  },
});
function remove(): void {
  if (
    !window.confirm(
      'Удалить группу и её ключевые слова? Уже отправленные заявки сохранятся.',
    )
  ) {
    return;
  }
  removeClassGroup(draft.value, props.groupId);
  emit('removed');
}
</script>
<template>
  <div v-if="group" class="class-editor class-card">
    <ClassGroupReview
      :model-value="group"
      :directions="draft.directions"
      :groups="draft.groups"
    />
    <label :for="'group-name-' + group.id">Название группы</label>
    <input
      :id="'group-name-' + group.id"
      v-model="group.name"
      maxlength="80"
      placeholder="Например, Начинающие"
    />
    <label :for="'group-time-' + group.id + '-0'">Дни и время занятий</label>
    <textarea
      :id="'group-time-' + group.id + '-0'"
      v-model="schedule"
      rows="2"
      aria-describedby="class-schedule-hint"
      placeholder="Пн/Ср — 20:00 или Пн 20:00, Ср 19:00"
    />
    <p id="class-schedule-hint" class="class-hint">
      Укажите все дни и время в одном поле. Например, Пн/Ср — 20:00 или Пн
      20:00, Ср 19:00.
    </p>
    <ClassEnrollmentSettings v-model="group" />
    <ClassKeywordsEditor
      v-model="draft"
      target-type="group"
      :target-id="group.id"
      @open-target="(type, id) => emit('openTarget', type, id)"
    />
    <div class="class-actions">
      <button
        type="button"
        class="secondary-button"
        @click="emit('preview', 'classes:group:' + group.id)"
      >
        Посмотреть как клиент
      </button>
    </div>
    <ClassGroupSettings
      :model-value="group"
      :directions="draft.directions"
      @remove="remove"
    />
  </div>
</template>
<style scoped src="../styles/class-editor.css"></style>
