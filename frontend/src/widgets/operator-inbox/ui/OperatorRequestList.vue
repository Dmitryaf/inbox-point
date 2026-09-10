<script setup lang="ts">
import type { OperatorInboxRequest } from '@frontend/entities/operations/model/types';
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';

defineProps<{
  requests: readonly OperatorInboxRequest[];
  selectedRequestId: string;
}>();
defineEmits<{ select: [requestId: string] }>();

function channelName(channel: 'telegram' | 'vk'): string {
  return channel === 'telegram' ? 'Telegram' : 'VK';
}
</script>

<template>
  <nav class="operator-request-list" aria-label="Активные обращения">
    <button
      v-for="request in requests"
      :key="request.id"
      class="operator-request-button"
      :class="{
        'operator-request-button--selected': request.id === selectedRequestId,
      }"
      type="button"
      :aria-pressed="request.id === selectedRequestId"
      @click="$emit('select', request.id)"
    >
      <strong>{{ request.displayName || 'Без имени' }}</strong>
      <span class="channel-badge">{{ channelName(request.channel) }}</span>
      <time :datetime="request.latestMessageAt || request.createdAt">
        {{ formatShortDateTime(request.latestMessageAt || request.createdAt) }}
      </time>
    </button>
  </nav>
</template>

<style scoped src="../styles/operator-request-list.css"></style>
