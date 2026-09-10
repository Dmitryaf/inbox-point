<script setup lang="ts">
import { computed } from 'vue';

import {
  formatFaqResponse,
  normalizeFaqItems,
} from '@frontend/entities/content/lib/client-response-preview';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import FieldError from '@frontend/shared/ui/FieldError.vue';
import SectionVisibilityControl from './SectionVisibilityControl.vue';

const draft = defineModel<ContentDraft>({ required: true });
withDefaults(
  defineProps<{ errors?: Readonly<Record<string, string | undefined>> }>(),
  { errors: () => ({}) },
);
const responseLength = computed(() =>
  draft.value.faq.length > 0
    ? formatFaqResponse(normalizeFaqItems(draft.value.faq)).length
    : 0,
);

function add(): void {
  if (draft.value.faq.length < 20) {
    draft.value.faq.push({ answer: '', question: '' });
  }
}

function move(index: number, offset: -1 | 1): void {
  const target = index + offset;
  if (target < 0 || target >= draft.value.faq.length) {
    return;
  }
  const [item] = draft.value.faq.splice(index, 1);
  if (item) {
    draft.value.faq.splice(target, 0, item);
  }
}
</script>

<template>
  <section class="card">
    <div class="section-heading">
      <div>
        <p class="step">Готовый раздел меню</p>
        <h2>Частые вопросы</h2>
      </div>
      <span>{{ draft.faq.length }} / 20</span>
    </div>
    <p>Вопросы показываются в этом порядке.</p>
    <p
      class="counter"
      :class="{ 'counter--error': responseLength > 4000 }"
      aria-live="polite"
    >
      Итоговый ответ: {{ responseLength }} / 4000
    </p>
    <SectionVisibilityControl
      v-model="draft.visibleSections"
      :content-present="draft.faq.length > 0"
      section="faq"
    />
    <p v-if="draft.faq.length === 0" class="empty">
      Добавьте хотя бы один вопрос и ответ, чтобы показать этот раздел.
    </p>
    <fieldset v-for="(item, index) in draft.faq" :key="index" class="item-card">
      <legend>Вопрос {{ index + 1 }}</legend>
      <label :for="`faq-question-${index}`">Вопрос</label>
      <input
        :id="`faq-question-${index}`"
        v-model="item.question"
        :aria-describedby="
          errors[`faq-question-${index}`]
            ? `faq-question-${index}-error`
            : undefined
        "
        :aria-invalid="Boolean(errors[`faq-question-${index}`])"
        maxlength="300"
        required
      />
      <FieldError
        :id="`faq-question-${index}-error`"
        :text="errors[`faq-question-${index}`]"
      />
      <p class="counter">{{ item.question.length }} / 300</p>
      <label :for="`faq-answer-${index}`">Ответ</label>
      <textarea
        :id="`faq-answer-${index}`"
        v-model="item.answer"
        :aria-describedby="
          errors[`faq-answer-${index}`]
            ? `faq-answer-${index}-error`
            : undefined
        "
        :aria-invalid="Boolean(errors[`faq-answer-${index}`])"
        maxlength="3000"
        required
        rows="4"
      />
      <FieldError
        :id="`faq-answer-${index}-error`"
        :text="errors[`faq-answer-${index}`]"
      />
      <p class="counter">{{ item.answer.length }} / 3000</p>
      <div class="item-actions">
        <button
          class="quiet"
          type="button"
          :disabled="index === 0"
          :aria-label="`Переместить вопрос ${index + 1} выше`"
          @click="move(index, -1)"
        >
          Выше
        </button>
        <button
          class="quiet"
          type="button"
          :disabled="index === draft.faq.length - 1"
          :aria-label="`Переместить вопрос ${index + 1} ниже`"
          @click="move(index, 1)"
        >
          Ниже
        </button>
        <button
          class="danger"
          type="button"
          @click="draft.faq.splice(index, 1)"
        >
          Удалить
        </button>
      </div>
    </fieldset>
    <button :disabled="draft.faq.length >= 20" type="button" @click="add">
      Добавить вопрос
    </button>
  </section>
</template>

<style scoped src="../styles/collection-editor.css"></style>
