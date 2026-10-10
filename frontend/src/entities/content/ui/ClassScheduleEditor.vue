<script setup lang="ts">
import { ref } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import ClassDirectionEditor from './ClassDirectionEditor.vue';
import ClassKeywordsEditor from './ClassKeywordsEditor.vue';
const draft = defineModel<ContentDraft>({ required: true });
const directionName = ref('');
const notice = ref('');
function add(): void {
  const name = directionName.value.trim();
  if (
    !name ||
    /[/:\r\n]/u.test(name) ||
    draft.value.directions.some(
      (item) =>
        item.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'),
    )
  ) {
    notice.value = 'Введите новое название направления, без / и :.';
    return;
  }
  draft.value.directions.push({ id: crypto.randomUUID(), name });
  directionName.value = '';
  notice.value = '';
}
</script>
<template>
  <section class="class-editor" aria-label="Направления и группы">
    <h3 id="class-directions" tabindex="-1">Направления и группы</h3>
    <p>
      Создайте направление, добавьте группы и укажите дни занятий. Клиент
      выберет группу и сможет оставить заявку.
    </p>
    <ClassDirectionEditor
      v-for="direction in draft.directions"
      :key="direction.id"
      v-model="draft"
      :direction-id="direction.id"
    />
    <label for="new-direction-name">Новое направление</label>
    <div class="class-actions">
      <input
        id="new-direction-name"
        v-model="directionName"
        maxlength="80"
        placeholder="Например, Бачата"
        @keydown.enter.prevent="add"
      />
      <button
        type="button"
        :disabled="draft.directions.length >= 20"
        @click="add"
      >
        Добавить направление
      </button>
    </div>
    <p v-if="notice" role="status">{{ notice }}</p>
    <ClassKeywordsEditor v-model="draft" />
  </section>
</template>
<style scoped src="../styles/class-editor.css"></style>
