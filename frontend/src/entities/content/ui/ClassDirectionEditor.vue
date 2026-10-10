<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { addClassGroup } from '@frontend/entities/content/model/class-editor';
import ClassGroupEditor from './ClassGroupEditor.vue';
const draft = defineModel<ContentDraft>({ required: true });
const props = defineProps<{ directionId: string }>();
const direction = computed(() =>
  draft.value.directions.find((item) => item.id === props.directionId),
);
const groups = computed(() =>
  draft.value.groups.filter((item) => item.directionId === props.directionId),
);
const notice = ref('');
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
}
</script>
<template>
  <details v-if="direction" class="class-card" open>
    <summary>
      <strong>{{ direction.name || 'Новое направление' }}</strong> ·
      {{ groups.length }} групп
    </summary>
    <label :for="`direction-${direction.id}`">Название направления</label>
    <input
      :id="`direction-${direction.id}`"
      v-model="direction.name"
      maxlength="80"
    />
    <ClassGroupEditor
      v-for="group in groups"
      :key="group.id"
      v-model="draft"
      :group-id="group.id"
    />
    <div class="class-actions">
      <button
        type="button"
        :disabled="draft.groups.length >= 60"
        @click="addClassGroup(draft, directionId)"
      >
        Добавить группу
      </button>
      <button type="button" class="danger" @click="remove">
        Удалить направление
      </button>
    </div>
    <p v-if="notice" role="status">{{ notice }}</p>
  </details>
</template>
<style scoped src="../styles/class-editor.css"></style>
