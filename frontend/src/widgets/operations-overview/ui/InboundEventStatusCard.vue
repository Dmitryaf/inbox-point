<script setup lang="ts">
import type { InboundEventOperationsStatus } from '@frontend/entities/operations/model/types';

defineProps<{
  inboundEvents: InboundEventOperationsStatus;
}>();
</script>

<template>
  <article class="status-card delivery-card">
    <div class="status-card-heading">
      <h3>Сообщения VK</h3>
      <span
        class="status-pill"
        :class="
          inboundEvents.state === 'healthy'
            ? 'status-pill--healthy'
            : 'status-pill--attention'
        "
      >
        {{ inboundEvents.state === 'healthy' ? 'Работает' : 'Нужна проверка' }}
      </span>
    </div>
    <p v-if="inboundEvents.state === 'healthy'">
      Новые сообщения обрабатываются автоматически.
    </p>
    <p v-else>Подробности и доступные действия показаны выше.</p>
  </article>
</template>

<style scoped src="../styles/status-card.css"></style>
