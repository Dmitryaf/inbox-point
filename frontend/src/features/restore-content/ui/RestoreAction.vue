<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  hasUnsavedChanges: boolean;
  pending: boolean;
  revision: number;
}>();
const emit = defineEmits<{ restore: [revision: number] }>();
const confirming = ref(false);
</script>

<template>
  <div v-if="confirming" class="restore-confirm">
    <p>Заменить текущую информацию этой версией?</p>
    <p v-if="hasUnsavedChanges" class="warning-text">
      Несохранённые изменения будут потеряны.
    </p>
    <button
      :disabled="pending"
      type="button"
      @click="emit('restore', props.revision)"
    >
      {{ pending ? 'Восстанавливаем…' : 'Да, восстановить' }}
    </button>
    <button
      class="quiet"
      :disabled="pending"
      type="button"
      @click="confirming = false"
    >
      Отмена
    </button>
  </div>
  <button v-else class="quiet" type="button" @click="confirming = true">
    Восстановить
  </button>
</template>

<style scoped src="../styles/restore-action.css"></style>
