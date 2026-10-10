<script setup lang="ts">
import { computed } from 'vue';
import { normalizeKeyword, groupTitle } from '@core/application/class-content';
import type { ClassKeyword } from '@core/application/class-content';
import type { ContentDraft } from '@frontend/entities/content/model/types';
const draft = defineModel<ContentDraft>({ required: true });
const props = defineProps<{
  targetType: 'direction' | 'group';
  targetId: string;
}>();
const emit = defineEmits<{
  openTarget: [type: 'direction' | 'group', id: string];
}>();
const words = computed(() =>
  draft.value.keywords.filter(
    (item) =>
      item.targetType === props.targetType && item.targetId === props.targetId,
  ),
);
function conflict(word: ClassKeyword): ClassKeyword | undefined {
  return draft.value.keywords.find(
    (item) =>
      item !== word &&
      normalizeKeyword(item.phrase) === normalizeKeyword(word.phrase) &&
      Boolean(word.phrase.trim()),
  );
}
function targetLabel(word: ClassKeyword): string {
  const group = draft.value.groups.find((item) => item.id === word.targetId);
  return word.targetType === 'group' && group
    ? groupTitle(draft.value, group)
    : (draft.value.directions.find((item) => item.id === word.targetId)?.name ??
        '');
}
function remove(word: ClassKeyword): void {
  draft.value.keywords = draft.value.keywords.filter((item) => item !== word);
}
</script>
<template>
  <section class="class-card" aria-label="Переход из объявления">
    <h3>Переход из объявления</h3>
    <p>
      По этому слову в сообщениях бот покажет
      {{ targetType === 'group' ? 'эту группу' : 'группы этого направления' }}.
    </p>
    <div v-for="(word, index) in words" :key="index" class="class-word">
      <label :for="'keyword-' + targetId + '-' + index"
        >Слово или фраза {{ index + 1 }}</label
      >
      <input
        :id="'keyword-' + targetId + '-' + index"
        v-model="word.phrase"
        maxlength="80"
        placeholder="Например, Бачата"
      />
      <p v-if="conflict(word)" role="alert">
        Слово «{{ word.phrase }}» уже открывает «{{
          targetLabel(conflict(word)!)
        }}».
        <button
          type="button"
          class="secondary-button"
          @click="
            emit(
              'openTarget',
              conflict(word)!.targetType,
              conflict(word)!.targetId,
            )
          "
        >
          Перейти к настройке
        </button>
      </p>
      <button type="button" class="danger" @click="remove(word)">
        Удалить слово
      </button>
    </div>
    <button
      type="button"
      :disabled="draft.keywords.length >= 40"
      @click="draft.keywords.push({ phrase: '', targetType, targetId })"
    >
      Добавить ключевое слово
    </button>
  </section>
</template>
<style scoped src="../styles/class-editor.css"></style>
