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
    <h2 id="preview-title">Что появится в каналах</h2>
    <p v-if="responses.length === 0" class="empty">
      Заполните разделы — здесь появится будущий ответ.
    </p>
    <article
      v-for="response in responses"
      v-else
      :key="response.label"
      class="preview-response"
    >
      <p class="preview-response-label">Кнопка «{{ response.label }}»</p>
      <p class="preserve">{{ response.text }}</p>
    </article>
  </section>
</template>
