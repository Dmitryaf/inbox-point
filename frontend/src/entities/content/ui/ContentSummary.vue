<script setup lang="ts">
import { computed } from 'vue';

import { buildClientResponsePreviews } from '@frontend/entities/content/lib/client-response-preview';
import { validateContentDraft } from '@frontend/entities/content/lib/content-validation';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import AppIcon from '@frontend/shared/ui/AppIcon.vue';

const props = defineProps<{ content: ContentDraft }>();

const responses = computed(() => buildClientResponsePreviews(props.content));
const validation = computed(() => validateContentDraft(props.content));
const standardCount = computed(
  () =>
    responses.value.filter((response) => response.group === 'information')
      .length,
);
const customCount = computed(
  () =>
    responses.value.filter((response) => response.group === 'custom').length,
);
const summaryTitle = computed(() => {
  if (!validation.value.valid) {
    return 'Нужно исправить поля';
  }
  return responses.value.length ? 'Готово к показу' : 'Пока не заполнено';
});
</script>

<template>
  <details class="content-summary">
    <summary>
      <span class="summary-title">
        {{ summaryTitle }}
      </span>
      <span> · Ответов в меню: {{ responses.length }}</span>
    </summary>

    <dl class="content-facts">
      <div>
        <dt>Основные ответы</dt>
        <dd>{{ standardCount }} из 4</dd>
      </div>
      <div>
        <dt>Частые вопросы</dt>
        <dd>{{ content.faq.length }}</dd>
      </div>
      <div>
        <dt>Свои разделы</dt>
        <dd>{{ customCount }}</dd>
      </div>
    </dl>

    <p class="channel-note">
      <AppIcon name="check" /> После сохранения изменения появятся в Telegram и
      VK.
    </p>
  </details>
</template>

<style scoped src="../styles/content-summary.css"></style>
