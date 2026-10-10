<script setup lang="ts">
import type {
  ClassGroup,
  ClassDirection,
} from '@core/application/class-content';
const group = defineModel<ClassGroup>({ required: true });
defineProps<{ directions: ClassDirection[] }>();
defineEmits<{ remove: [] }>();
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
    <label :for="'group-question-' + group.id"
      >Что спросить после нажатия «Записаться»</label
    >
    <textarea
      :id="'group-question-' + group.id"
      v-model="group.applicationQuestion"
      rows="2"
      maxlength="1000"
      placeholder="Как к вам обращаться и на какое занятие планируете прийти?"
    />
    <label v-if="!group.review" :for="'group-direction-' + group.id"
      >Направление</label
    >
    <select
      v-if="!group.review"
      :id="'group-direction-' + group.id"
      v-model="group.directionId"
    >
      <option v-for="item in directions" :key="item.id" :value="item.id">
        {{ item.name }}
      </option>
    </select>
    <button type="button" class="danger" @click="$emit('remove')">
      Удалить группу
    </button>
  </details>
</template>
<style scoped src="../styles/class-editor.css"></style>
