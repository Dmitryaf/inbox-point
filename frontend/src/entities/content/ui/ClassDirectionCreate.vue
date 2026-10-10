<script setup lang="ts">
import { ref } from 'vue';
import { normalizeKeyword } from '@core/application/class-content';
import type { ContentDraft } from '@frontend/entities/content/model/types';
const draft = defineModel<ContentDraft>({ required: true });
const emit = defineEmits<{ created: [id: string] }>();
const adding = ref(false);
const directionName = ref('');
const notice = ref('');
function add(): void {
  const name = directionName.value.trim();
  if (
    !name ||
    /[/:\r\n]/u.test(name) ||
    draft.value.directions.some(
      (item) => normalizeKeyword(item.name) === normalizeKeyword(name),
    )
  ) {
    notice.value = 'Введите новое название направления, без / и :.';
    return;
  }
  const id = crypto.randomUUID();
  draft.value.directions.push({ id, name });
  directionName.value = '';
  notice.value = '';
  adding.value = false;
  emit('created', id);
}
</script>
<template>
  <button
    v-if="!adding"
    type="button"
    :disabled="draft.directions.length >= 20"
    @click="adding = true"
  >
    Добавить направление
  </button>
  <form v-else class="class-editor" @submit.prevent="add">
    <label for="new-direction-name">Новое направление</label>
    <input
      id="new-direction-name"
      v-model="directionName"
      maxlength="80"
      placeholder="Например, Бачата"
    />
    <div class="class-actions">
      <button type="submit">Создать направление</button
      ><button type="button" class="secondary-button" @click="adding = false">
        Отмена
      </button>
    </div>
    <p v-if="notice" role="status">{{ notice }}</p>
  </form>
</template>
<style scoped src="../styles/class-editor.css"></style>
