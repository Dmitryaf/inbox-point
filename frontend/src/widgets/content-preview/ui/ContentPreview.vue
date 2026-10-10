<script setup lang="ts">
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { useContentPreview } from '@frontend/widgets/content-preview/model/use-content-preview';
const props = defineProps<{ content: ContentDraft; startAction?: string }>();
const { action, response, buttonRows, empty } = useContentPreview(props);
</script>
<template>
  <section class="card preview" aria-labelledby="preview-title">
    <h2 id="preview-title">Предпросмотр ответов</h2>
    <p class="preview-intro">
      Нажимайте кнопки, чтобы пройти путь клиента. Здесь показаны текст и
      действия; оформление кнопок зависит от VK или Telegram. Сообщения не
      отправляются.
    </p>
    <button type="button" class="secondary-button" @click="action = 'main'">
      Начать с меню
    </button>
    <p v-if="empty" class="empty">
      Заполните разделы — здесь появится будущий ответ.
    </p>
    <div class="message-preview" aria-label="Пример переписки">
      <article class="preview-response" aria-live="polite">
        <p class="preview-service-message">{{ response.text }}</p>
        <p v-if="response.applicationLabel" class="preview-intro">
          Здесь клиент напишет ответ. Он придёт администратору как заявка «{{
            response.applicationLabel
          }}».
        </p>
        <p v-else-if="response.beginQuestion" class="preview-intro">
          Следующее сообщение клиента придёт администратору{{
            response.questionContext ? ' вместе с названием группы' : ''
          }}.
        </p>
      </article>
      <div class="message-preview-buttons" aria-label="Кнопки бота">
        <div
          v-for="(row, rowIndex) in buttonRows"
          :key="rowIndex"
          class="message-preview-button-row"
          :class="{ 'message-preview-button-row--single': row.length === 1 }"
        >
          <button
            v-for="button in row"
            :key="button.action"
            type="button"
            class="secondary-button"
            @click="action = button.action"
          >
            {{ button.label }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
<style scoped src="../styles/content-preview.css"></style>
