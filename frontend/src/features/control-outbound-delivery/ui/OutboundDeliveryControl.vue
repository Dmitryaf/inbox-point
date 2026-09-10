<script setup lang="ts">
import type { OperationsStatus } from '@frontend/entities/operations/model/types';

defineProps<{
  outbound: OperationsStatus['outbound'];
  pending: 'pause' | 'resume' | undefined;
}>();
defineEmits<{ change: [mode: 'pause' | 'resume'] }>();
</script>

<template>
  <section class="outbound-delivery-control">
    <div>
      <p v-if="outbound.mode === 'paused'">
        Ответы не отправляются. Новые ответы сохраняются до возобновления.
      </p>
      <p v-else>Ответы отправляются автоматически.</p>
    </div>
    <button
      v-if="outbound.mode === 'active'"
      class="danger"
      type="button"
      :disabled="Boolean(pending)"
      @click="$emit('change', 'pause')"
    >
      {{ pending === 'pause' ? 'Приостанавливаем…' : 'Приостановить ответы' }}
    </button>
    <button
      v-else
      type="button"
      :disabled="Boolean(pending)"
      @click="$emit('change', 'resume')"
    >
      {{ pending === 'resume' ? 'Возобновляем…' : 'Возобновить ответы' }}
    </button>
  </section>
</template>

<style scoped src="../styles/outbound-delivery-control.css"></style>
