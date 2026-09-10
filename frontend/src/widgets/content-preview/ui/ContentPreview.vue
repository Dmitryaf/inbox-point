<script setup lang="ts">
import { computed } from 'vue';

import { buildClientResponsePreviews } from '@frontend/entities/content/lib/client-response-preview';
import type { ContentDraft } from '@frontend/entities/content/model/types';

const props = defineProps<{ content: ContentDraft }>();
const responses = computed(() => buildClientResponsePreviews(props.content));
</script>

<template>
  <section class="card preview" aria-labelledby="preview-title">
    <p class="step">Предпросмотр</p>
    <h2 id="preview-title">Так клиент увидит ваши ответы</h2>
    <p class="preview-intro">
      Это пример. В Telegram и VK оформление немного различается, но кнопки и
      тексты будут такими же.
    </p>
    <p v-if="responses.length === 0" class="empty">
      Заполните разделы — здесь появится будущий ответ.
    </p>
    <div v-else class="message-preview" aria-label="Пример переписки">
      <div class="message-preview-menu">
        <p>Здравствуйте! Чем помочь?</p>
        <div class="message-preview-buttons" aria-label="Кнопки меню">
          <span v-for="response in responses" :key="response.label">
            {{ response.label }}
          </span>
          <span>Задать вопрос</span>
        </div>
      </div>
      <article
        v-for="response in responses"
        :key="response.label"
        class="preview-response"
      >
        <p class="preview-client-message">{{ response.label }}</p>
        <p class="preview-service-message">{{ response.text }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped src="../styles/content-preview.css"></style>
