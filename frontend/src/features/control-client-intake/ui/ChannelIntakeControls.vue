<script setup lang="ts">
import type {
  ClientChannel,
  ServiceControlState,
} from '@frontend/entities/service-control/model/types';

const props = defineProps<{
  pendingChannel: ClientChannel | undefined;
  state: ServiceControlState;
}>();
defineEmits<{
  change: [channel: ClientChannel, mode: 'active' | 'paused'];
}>();

function channelName(channel: ClientChannel): string {
  return channel === 'telegram' ? 'Telegram' : 'VK';
}

function pauseExplanation(channel: ClientChannel): string {
  const channelIsPaused = props.state.channels[channel].mode === 'paused';
  if (channelIsPaused) {
    return channel === 'telegram'
      ? 'Бот не передаёт новые обращения оператору и сообщает клиенту о паузе.'
      : 'Новые сообщения остаются в VK, но не появляются у оператора.';
  }
  if (channel === 'telegram') {
    return 'Новый вопрос можно задать через бота.';
  }
  return 'Новый вопрос можно задать через сообщество.';
}
</script>

<template>
  <div class="intake-channel-list">
    <article v-for="channel in ['telegram', 'vk'] as const" :key="channel">
      <div>
        <div class="intake-channel-heading">
          <strong>{{ channelName(channel) }}</strong>
          <span
            class="intake-status"
            :class="{
              'intake-status--paused':
                state.channels[channel].mode === 'paused',
            }"
          >
            {{
              state.channels[channel].mode === 'paused'
                ? 'На паузе'
                : 'Приём включён'
            }}
          </span>
        </div>
        <p>{{ pauseExplanation(channel) }}</p>
      </div>
      <button
        v-if="state.channels[channel].mode === 'active'"
        class="danger"
        type="button"
        :disabled="Boolean(pendingChannel)"
        @click="$emit('change', channel, 'paused')"
      >
        {{ pendingChannel === channel ? 'Приостанавливаем…' : 'Приостановить' }}
      </button>
      <button
        v-else
        type="button"
        :disabled="Boolean(pendingChannel)"
        @click="$emit('change', channel, 'active')"
      >
        {{ pendingChannel === channel ? 'Возобновляем…' : 'Возобновить' }}
      </button>
    </article>
  </div>
</template>

<style scoped src="../styles/channel-intake-controls.css"></style>
