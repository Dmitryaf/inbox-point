<script setup lang="ts">
import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import type {
  ClientChannel,
  ServiceControlState,
} from '@frontend/entities/service-control/model/types';

const props = defineProps<{
  channels: OperationsStatus['channels'];
  pendingChannel: ClientChannel | undefined;
  state: ServiceControlState;
}>();
defineEmits<{
  change: [channel: ClientChannel, mode: 'active' | 'paused'];
}>();

function channelName(channel: ClientChannel): string {
  return channel === 'telegram' ? 'Telegram' : 'VK';
}

function canPause(channel: ClientChannel): boolean {
  return (
    props.channels[channel].configured &&
    props.state.channels[channel].mode === 'active'
  );
}

function pauseExplanation(channel: ClientChannel): string {
  if (!props.channels[channel].configured) {
    return `Подключите ${channelName(channel)} в разделе «Каналы».`;
  }
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
              'intake-status--disconnected': !channels[channel].configured,
              'intake-status--paused':
                channels[channel].configured &&
                state.channels[channel].mode === 'paused',
            }"
          >
            {{
              !channels[channel].configured
                ? 'Не подключён'
                : state.channels[channel].mode === 'paused'
                  ? 'На паузе'
                  : 'Приём включён'
            }}
          </span>
        </div>
        <p>{{ pauseExplanation(channel) }}</p>
      </div>
      <button
        v-if="canPause(channel)"
        class="danger"
        type="button"
        :disabled="Boolean(pendingChannel)"
        @click="$emit('change', channel, 'paused')"
      >
        {{ pendingChannel === channel ? 'Приостанавливаем…' : 'Приостановить' }}
      </button>
      <button
        v-else-if="channels[channel].configured"
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
