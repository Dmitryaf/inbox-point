<script setup lang="ts">
import { computed } from 'vue';

import {
  connectionSourceLabel,
  formatStatusTime,
} from '@frontend/entities/operations/lib/status-format';
import type {
  ChannelOperationsStatus,
  ClientIntakeOperationsStatus,
} from '@frontend/entities/operations/model/types';

const props = defineProps<{
  channel: ChannelOperationsStatus;
  intake: ClientIntakeOperationsStatus;
  name: string;
}>();

const state = computed(() => {
  if (props.channel.state === 'not_configured') {
    return { label: 'Не настроен', tone: 'neutral' };
  }
  if (props.channel.state === 'poll_failed') {
    return { label: 'Ошибка связи', tone: 'attention' };
  }
  if (props.channel.state === 'poll_stale') {
    return { label: 'Нет свежих данных', tone: 'attention' };
  }
  if (props.channel.state === 'running') {
    return { label: 'Работает', tone: 'healthy' };
  }
  if (props.channel.state === 'starting') {
    return { label: 'Запускается', tone: 'neutral' };
  }
  return { label: 'Не работает', tone: 'attention' };
});
</script>

<template>
  <article class="status-card">
    <div class="status-card-heading">
      <h3>{{ name }}</h3>
      <span class="status-pill" :class="`status-pill--${state.tone}`">
        {{ state.label }}
      </span>
    </div>
    <p>{{ connectionSourceLabel(channel.source) }}</p>
    <p v-if="intake.mode === 'paused'" class="channel-maintenance-note">
      Новые обращения приостановлены вручную.
    </p>
    <details
      v-if="channel.configured"
      class="technical-details channel-details"
    >
      <summary>Подробности</summary>
      <dl class="channel-activity">
        <div>
          <dt>Последняя успешная проверка</dt>
          <dd>{{ formatStatusTime(channel.lastSuccessfulPollAt) }}</dd>
        </div>
        <div v-if="channel.lastFailedPollAt">
          <dt>Последняя ошибка связи</dt>
          <dd>{{ formatStatusTime(channel.lastFailedPollAt) }}</dd>
        </div>
      </dl>
    </details>
  </article>
</template>

<style scoped src="../styles/status-card.css"></style>
<style scoped src="../styles/channel-status-card.css"></style>
