<script setup lang="ts">
import type { OperationsStatus } from '@frontend/entities/operations/model/types';

defineProps<{
  outbound: OperationsStatus['outbound'];
  pending: 'pause' | 'resume' | undefined;
}>();
defineEmits<{ change: [mode: 'pause' | 'resume'] }>();
</script>

<template>
  <section class="outbound-emergency-control">
    <div>
      <strong>Аварийная остановка</strong>
      <p v-if="outbound.mode === 'paused'">
        Доставка ответов остановлена. Новые ответы сохраняются в очереди.
      </p>
      <p v-else>
        Исходящая доставка включена; очередь обрабатывается автоматически.
      </p>
    </div>
    <button
      v-if="outbound.mode === 'active'"
      class="danger"
      type="button"
      :disabled="Boolean(pending)"
      @click="$emit('change', 'pause')"
    >
      {{ pending === 'pause' ? 'Останавливаем…' : 'Остановить доставку' }}
    </button>
    <button
      v-else
      type="button"
      :disabled="Boolean(pending)"
      @click="$emit('change', 'resume')"
    >
      {{ pending === 'resume' ? 'Возобновляем…' : 'Возобновить доставку' }}
    </button>
  </section>
</template>
