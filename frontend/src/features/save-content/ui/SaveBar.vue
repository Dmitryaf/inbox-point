<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  dirty: boolean;
  saving: boolean;
  validationMessage: string;
  valid: boolean;
}>();
defineEmits<{ save: [] }>();

const statusMessage = computed(() => {
  if (props.saving) {
    return 'Сохраняем изменения…';
  }
  if (props.validationMessage) {
    return props.validationMessage;
  }
  if (props.dirty) {
    return 'Есть несохранённые изменения';
  }
  return 'Все изменения сохранены';
});
</script>

<template>
  <div class="save-bar">
    <div>
      <span class="save-bar-label">Сохранятся изменения во всех разделах</span>
      <p :class="{ changed: dirty }" role="status">
        {{ statusMessage }}
      </p>
    </div>
    <button
      :aria-busy="saving"
      :disabled="saving || !dirty"
      type="button"
      @click="$emit('save')"
    >
      Сохранить
    </button>
  </div>
</template>

<style scoped src="../styles/save-bar.css"></style>
