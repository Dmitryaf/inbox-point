<script setup lang="ts">
import { computed } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { removeClassGroup } from '@frontend/entities/content/model/class-editor';
import ClassGroupPreview from './ClassGroupPreview.vue';
import ClassGroupReview from './ClassGroupReview.vue';
import ClassGroupSettings from './ClassGroupSettings.vue';
import ClassKeywordsEditor from './ClassKeywordsEditor.vue';
const draft = defineModel<ContentDraft>({ required: true });
const props = defineProps<{ groupId: string }>();
const emit = defineEmits<{
  openTarget: [type: 'direction' | 'group', id: string];
  removed: [];
}>();
const group = computed(() =>
  draft.value.groups.find((item) => item.id === props.groupId),
);
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
    <div
      v-for="(_, index) in group.meetings"
      :key="index"
      class="class-meeting"
    >
      <label :for="'group-time-' + group.id + '-' + index"
        >День и время {{ index + 1 }}</label
      >
      <div class="class-actions">
        <input
          :id="'group-time-' + group.id + '-' + index"
          v-model="group.meetings[index]"
          maxlength="120"
          placeholder="Понедельник, 19:00"
        />
        <button
          v-if="group.meetings.length > 1"
          type="button"
          @click="group.meetings.splice(index, 1)"
        >
          Удалить время {{ index + 1 }}
        </button>
      </div>
    </div>
    <button
      type="button"
      :disabled="group.meetings.length >= 7"
      @click="group.meetings.push('')"
    >
      Добавить день и время
    </button>
    <label class="class-check">
      <input
        v-model="group.enrollmentOpen"
        type="checkbox"
        :disabled="Boolean(group.review)"
      />
      Открыть набор в группу
    </label>
    <p>После ответа клиента вы получите заявку и сможете подтвердить место.</p>
    <ClassKeywordsEditor
      v-model="draft"
      target-type="group"
      :target-id="group.id"
      @open-target="(type, id) => emit('openTarget', type, id)"
    />
    <ClassGroupPreview :content="draft" :group-id="group.id" />
    <ClassGroupSettings
      :model-value="group"
      :directions="draft.directions"
      @remove="remove"
    />
  </div>
</template>
<style scoped src="../styles/class-editor.css"></style>
