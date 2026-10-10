<script setup lang="ts">
import { computed, ref } from 'vue';
import { renderClassAction } from '@core/application/class-navigation';
import { previewClassInformation } from '@frontend/entities/content/lib/class-preview';
import type { ContentDraft } from '@frontend/entities/content/model/types';
const props = defineProps<{ content: ContentDraft; groupId: string }>();
const operation = ref('group');
const response = computed(() => {
  return renderClassAction(
    previewClassInformation(props.content),
    `classes:${operation.value}:${props.groupId}`,
  );
});
function select(action: string): void {
  const next = action.split(':')[1];
  if (['group', 'times', 'signup', 'prices', 'question'].includes(next ?? '')) {
    operation.value = next!;
  }
}
</script>
<template>
  <details class="class-preview">
    <summary>Что увидит клиент</summary>
    <p>
      Пример текста и действий. Внешний вид кнопок зависит от VK или Telegram.
    </p>
    <pre>{{ response.text }}</pre>
    <div class="class-preview-buttons">
      <button
        v-for="item in response.buttons"
        :key="item.action"
        type="button"
        @click="select(item.action)"
      >
        {{ item.label }}
      </button>
    </div>
  </details>
</template>
<style scoped src="../styles/class-editor.css"></style>
