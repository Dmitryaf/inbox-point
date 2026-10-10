<script setup lang="ts">
import type { ClassGroup } from '@core/application/class-content';
const group = defineModel<ClassGroup>({ required: true });
</script>
<template>
  <details class="class-card">
    <summary>Дополнительные настройки</summary>
    <label :for="'group-description-' + group.id"
      >Короткое описание группы</label
    >
    <textarea
      :id="'group-description-' + group.id"
      v-model="group.description"
      rows="3"
      maxlength="1000"
    />
  </details>
</template>
<style scoped src="../styles/class-editor.css"></style>
