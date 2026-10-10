<script setup lang="ts">
import { computed } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import ClassDirectionCreate from './ClassDirectionCreate.vue';
import SectionVisibilityControl from './SectionVisibilityControl.vue';
const draft = defineModel<ContentDraft>({ required: true });
const reviewing = defineModel<boolean>('reviewing', { required: true });
const emit = defineEmits<{
  openTarget: [type: 'direction' | 'group', id: string];
}>();
const pending = computed(() =>
  draft.value.groups.filter((group) => group.review),
);
</script>
<template>
  <template v-if="reviewing">
    <button
      v-for="item in pending"
      :key="item.id"
      class="class-list-item"
      type="button"
      @click="emit('openTarget', 'group', item.id)"
    >
      <strong>{{
        item.name || item.review?.source.split('\n')[0] || 'Занятие'
      }}</strong>
      <small>Нужно проверить</small>
    </button>
    <p v-if="!pending.length">Все записи проверены.</p>
  </template>
  <template v-else>
    <button
      v-if="pending.length"
      type="button"
      class="review-notice"
      @click="reviewing = true"
    >
      Нужно проверить: {{ pending.length }}
    </button>
    <p v-if="!draft.directions.length && !pending.length">
      Добавьте направление, затем создайте в нём группы.
    </p>
    <button
      v-for="item in draft.directions"
      :key="item.id"
      class="class-list-item"
      type="button"
      @click="emit('openTarget', 'direction', item.id)"
    >
      <strong>{{ item.name || 'Новое направление' }}</strong>
      <small
        >Групп:
        {{
          draft.groups.filter(
            (entry) => entry.directionId === item.id && !entry.review,
          ).length
        }}</small
      >
    </button>
    <ClassDirectionCreate
      v-model="draft"
      @created="(id) => emit('openTarget', 'direction', id)"
    />
    <SectionVisibilityControl
      v-model="draft.visibleSections"
      :content-present="Boolean(draft.directions.length || draft.groups.length)"
      section="schedule"
    />
  </template>
</template>
<style scoped src="../styles/class-editor.css"></style>
