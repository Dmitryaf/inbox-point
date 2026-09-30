<script setup lang="ts">
import { ref } from 'vue';
import { loadContentRevision } from '@frontend/entities/content/api/content-api';
import type { ContentSnapshot } from '@frontend/entities/content/model/types';
import ContentRevision from '@frontend/entities/content/ui/ContentRevision.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

const props = defineProps<{
  hasUnsavedChanges: boolean;
  pending: boolean;
  revision: number;
}>();
const emit = defineEmits<{ restore: [revision: number]; unauthorized: [] }>();
const confirming = ref(false);
const snapshot = ref<ContentSnapshot>();
const loading = ref(false);
const error = ref('');

async function review(): Promise<void> {
  confirming.value = true;
  loading.value = true;
  error.value = '';
  snapshot.value = undefined;
  try {
    snapshot.value = await loadContentRevision(props.revision);
  } catch (cause: unknown) {
    error.value = requestErrorMessage(cause, () => emit('unauthorized'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="confirming" class="restore-confirm">
    <p v-if="loading" role="status">Загружаем версию…</p>
    <AsyncMessage kind="error" :text="error" />
    <button v-if="error" type="button" class="quiet" @click="review">
      Повторить загрузку версии
    </button>
    <ContentRevision v-if="snapshot" :snapshot="snapshot" />
    <p>
      Заменить все разделы, включая скрытые, этой версией? После восстановления
      информация сразу появится в Telegram и VK.
    </p>
    <p v-if="hasUnsavedChanges" class="warning-text">
      Несохранённые изменения будут потеряны.
    </p>
    <button
      :disabled="pending || loading || !snapshot"
      type="button"
      @click="emit('restore', props.revision)"
    >
      {{ pending ? 'Восстанавливаем…' : 'Да, восстановить' }}
    </button>
    <button
      class="quiet"
      :disabled="pending"
      type="button"
      @click="confirming = false"
    >
      Отмена
    </button>
  </div>
  <button
    v-else
    class="quiet"
    type="button"
    :disabled="pending"
    @click="review"
  >
    Посмотреть версию
  </button>
</template>

<style scoped src="../styles/restore-action.css"></style>
