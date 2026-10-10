<script setup lang="ts">
import { computed } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
const draft = defineModel<ContentDraft>({ required: true });
const targets = computed(() => [
  ...draft.value.directions.map((item) => ({
    value: `direction:${item.id}`,
    label: `Направление ${item.name}`,
  })),
  ...draft.value.groups.map((item) => ({
    value: `group:${item.id}`,
    label: `${draft.value.directions.find((direction) => direction.id === item.directionId)?.name ?? ''} → ${item.name}`,
  })),
]);
function change(index: number, event: Event): void {
  const [targetType, targetId] = (
    event.target as HTMLSelectElement
  ).value.split(':');
  const keyword = draft.value.keywords[index];
  if (
    keyword &&
    targetId &&
    (targetType === 'direction' || targetType === 'group')
  ) {
    keyword.targetType = targetType;
    keyword.targetId = targetId;
  }
}
function add(): void {
  const target = draft.value.groups[0] ?? draft.value.directions[0];
  if (target) {
    draft.value.keywords.push({
      phrase: '',
      targetType: draft.value.groups.length ? 'group' : 'direction',
      targetId: target.id,
    });
  }
}
</script>
<template>
  <details class="class-card" open>
    <summary><strong>Ключевые слова для постов</strong></summary>
    <p>
      Человек пишет слово в сообщения сообщества или бота и сразу видит
      выбранную группу или группы направления. Отдельная кнопка в главном меню
      не появится.
    </p>
    <p>
      Например: «Бачата» → Бачата / Начинающие. Регистр и лишние пробелы не
      важны. В переписке с администратором и при заполнении заявки слово
      остаётся обычным сообщением.
    </p>
    <div
      v-for="(keyword, index) in draft.keywords"
      :key="index"
      class="class-card"
    >
      <label :for="`keyword-${index}`">Слово или фраза {{ index + 1 }}</label>
      <input
        :id="`keyword-${index}`"
        v-model="keyword.phrase"
        maxlength="80"
        placeholder="Например, Бачата"
      />
      <label :for="`keyword-target-${index}`">Что открыть</label>
      <select
        :id="`keyword-target-${index}`"
        :value="`${keyword.targetType}:${keyword.targetId}`"
        @change="change(index, $event)"
      >
        <option
          v-for="target in targets"
          :key="target.value"
          :value="target.value"
        >
          {{ target.label }}
        </option>
      </select>
      <button
        type="button"
        class="danger"
        @click="draft.keywords.splice(index, 1)"
      >
        Удалить ключевое слово
      </button>
    </div>
    <button
      type="button"
      :disabled="!targets.length || draft.keywords.length >= 40"
      @click="add"
    >
      Добавить ключевое слово
    </button>
    <p v-if="!targets.length">Сначала добавьте направление или группу.</p>
  </details>
</template>
<style scoped src="../styles/class-editor.css"></style>
