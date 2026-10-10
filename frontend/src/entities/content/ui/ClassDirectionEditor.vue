<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { addClassGroup } from '@frontend/entities/content/model/class-editor';
import ClassKeywordsEditor from './ClassKeywordsEditor.vue';
const draft = defineModel<ContentDraft>({ required: true });
const props = defineProps<{ directionId: string }>();
const emit = defineEmits<{
  openTarget: [type: 'direction' | 'group', id: string];
  removed: [];
}>();
const direction = computed(() =>
  draft.value.directions.find((item) => item.id === props.directionId),
);
const groups = computed(() =>
  draft.value.groups.filter((item) => item.directionId === props.directionId),
);
const notice = ref('');
function add(): void {
  const id = addClassGroup(draft.value, props.directionId);
  if (id) {
    emit('openTarget', 'group', id);
  }
}
function remove(): void {
  if (groups.value.length) {
    notice.value =
      'Сначала перенесите группы в другое направление или удалите их.';
    return;
  }
  if (
    !window.confirm('Удалить направление и связанные с ним ключевые слова?')
  ) {
    return;
  }
  draft.value.directions = draft.value.directions.filter(
    (item) => item.id !== props.directionId,
  );
  draft.value.keywords = draft.value.keywords.filter(
    (item) =>
      item.targetType !== 'direction' || item.targetId !== props.directionId,
  );
  emit('removed');
}
</script>
<template>
  <div v-if="direction" class="class-editor">
    <p v-if="!groups.length">Добавьте группу и укажите расписание.</p>
    <button
      v-for="group in groups"
      :key="group.id"
      class="class-list-item"
      type="button"
      @click="emit('openTarget', 'group', group.id)"
    >
      <strong>{{ group.name || 'Новая группа' }}</strong
      ><small>{{
        group.review
          ? 'Заполните данные группы'
          : group.enrollmentOpen
            ? 'Набор открыт'
            : 'Набор закрыт'
      }}</small>
    </button>
    <button
      type="button"
      :disabled="draft.groups.filter((group) => !group.review).length >= 60"
      @click="add"
    >
      Добавить группу
    </button>
    <ClassKeywordsEditor
      v-model="draft"
      target-type="direction"
      :target-id="direction.id"
      @open-target="(type, id) => emit('openTarget', type, id)"
    />
    <details class="class-card">
      <summary>Настройки направления</summary>
      <label :for="'direction-' + direction.id">Название направления</label
      ><input
        :id="'direction-' + direction.id"
        v-model="direction.name"
        maxlength="80"
      />
      <button type="button" class="danger" @click="remove">
        Удалить направление
      </button>
      <p v-if="notice" role="status">{{ notice }}</p>
    </details>
  </div>
</template>
<style scoped src="../styles/class-editor.css"></style>
