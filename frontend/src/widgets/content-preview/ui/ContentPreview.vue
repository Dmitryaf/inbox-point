<script setup lang="ts">
import { computed } from 'vue';

import {
  buildClientResponsePreviews,
  buildTelegramMenuPreviewRows,
} from '@frontend/entities/content/lib/client-response-preview';
import type { ContentDraft } from '@frontend/entities/content/model/types';

const props = defineProps<{ content: ContentDraft }>();
const responses = computed(() => buildClientResponsePreviews(props.content));
const buttonRows = computed(() =>
  buildTelegramMenuPreviewRows(responses.value),
);
</script>

<template>
  <section class="card preview" aria-labelledby="preview-title">
    <p class="step">Предпросмотр</p>
    <h2 id="preview-title">Предпросмотр ответов</h2>
    <p class="preview-intro">Здесь показаны содержание и порядок ответов</p>
    <p v-if="responses.length === 0" class="empty">
      Заполните разделы — здесь появится будущий ответ.
    </p>
    <div v-else class="message-preview" aria-label="Пример переписки">
      <div class="message-preview-menu">
        <p>Здравствуйте! Чем помочь?</p>
      </div>
      <article
        v-for="response in responses"
        :key="response.label"
        class="preview-response"
      >
        <p class="preview-client-message">{{ response.label }}</p>
        <p class="preview-service-message">{{ response.text }}</p>
      </article>
      <div class="message-preview-buttons" aria-label="Кнопки меню Telegram">
        <div
          v-for="(row, rowIndex) in buttonRows"
          :key="rowIndex"
          class="message-preview-button-row"
          :class="{
            'message-preview-button-row--single': row.length === 1,
          }"
        >
          <span v-for="label in row" :key="label">{{ label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped src="../styles/content-preview.css"></style>
