<script setup lang="ts">
import { ref } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { transferScheduleItem } from '@frontend/entities/content/model/class-editor';
const draft = defineModel<ContentDraft>({ required: true });
const index = ref(0);
const directionId = ref('');
const notice = ref('');
function transfer(): void {
  const moved = transferScheduleItem(
    draft.value,
    index.value,
    directionId.value,
  );
  notice.value = moved
    ? 'Карточка перенесена в группу. Проверьте её и откройте набор при необходимости. Сохраните изменения.'
    : 'Выберите карточку и направление. Заполните название (до 80 символов, без / и :) и время. В направлении не должно быть группы с таким же названием.';
  index.value = 0;
}
</script>
<template>
  <details v-if="draft.schedule.length" class="class-card">
    <summary>Перенести старую карточку в группу</summary>
    <label for="legacy-class-item">Карточка</label>
    <select id="legacy-class-item" v-model="index">
      <option
        v-for="(item, position) in draft.schedule"
        :key="position"
        :value="position"
      >
        {{ item.title || `Карточка ${position + 1}` }}
      </option>
    </select>
    <label for="legacy-class-direction">Направление</label>
    <select id="legacy-class-direction" v-model="directionId">
      <option value="">Выберите направление</option>
      <option
        v-for="direction in draft.directions"
        :key="direction.id"
        :value="direction.id"
      >
        {{ direction.name }}
      </option>
    </select>
    <p>
      Название, время и описание перейдут в группу. Старая карточка будет
      заменена этой группой после сохранения. Набор сначала закрыт.
    </p>
    <button type="button" :disabled="!directionId" @click="transfer">
      Перенести в группу
    </button>
    <p v-if="notice" role="status">{{ notice }}</p>
  </details>
</template>
<style scoped src="../styles/class-editor.css"></style>
