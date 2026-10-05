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
  if (props.channel.state === 'configuration_missing') {
    return { label: 'Нужно подключить', tone: 'attention' };
  }
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
      <summary>Технические данные</summary>
      <dl class="channel-activity">
        <div>
          <dt>Последняя успешная проверка</dt>
          <dd>{{ formatStatusTime(channel.lastSuccessfulPollAt) }}</dd>
        </div>
        <div v-if="channel.lastFailedPollAt">
          <dt>Последняя ошибка связи</dt>
          <dd>{{ formatStatusTime(channel.lastFailedPollAt) }}</dd>
        </div>
        <div v-if="channel.consecutiveFailures">
          <dt>Ошибок подряд</dt>
          <dd>{{ channel.consecutiveFailures }}</dd>
        </div>
        <div v-if="channel.lastRecoveredAt">
          <dt>Связь восстановлена</dt>
          <dd>{{ formatStatusTime(channel.lastRecoveredAt) }}</dd>
        </div>
        <template v-if="channel.lastFailure">
          <div>
            <dt>Последний сбой</dt>
            <dd>
              {{
                channel.lastFailure.stage === 'startup'
                  ? 'При подключении'
                  : 'При получении данных'
              }}
            </dd>
          </div>
          <template v-if="channel.lastFailure.request">
            <div>
              <dt>Метод API</dt>
              <dd>{{ channel.lastFailure.request.method }}</dd>
            </div>
            <div>
              <dt>Тип ошибки</dt>
              <dd>
                {{
                  {
                    transport: 'Ошибка соединения',
                    http: 'Отказ HTTP',
                    api: 'Отказ API',
                    invalid_response: 'Некорректный ответ',
                  }[channel.lastFailure.request.kind]
                }}
              </dd>
            </div>
            <div>
              <dt>Длительность запроса</dt>
              <dd>{{ channel.lastFailure.request.durationMs }} мс</dd>
            </div>
            <div v-if="channel.lastFailure.request.transportCodes.length">
              <dt>Сетевой код</dt>
              <dd>
                {{ channel.lastFailure.request.transportCodes.join(', ') }}
              </dd>
            </div>
            <div v-if="channel.lastFailure.request.httpStatus">
              <dt>HTTP</dt>
              <dd>{{ channel.lastFailure.request.httpStatus }}</dd>
            </div>
            <div v-if="channel.lastFailure.request.apiCode !== undefined">
              <dt>Код API</dt>
              <dd>{{ channel.lastFailure.request.apiCode }}</dd>
            </div>
            <div>
              <dt>ID операции</dt>
              <dd>{{ channel.lastFailure.request.operationId }}</dd>
            </div>
          </template>
        </template>
      </dl>
    </details>
  </article>
</template>

<style scoped src="../styles/status-card.css"></style>
<style scoped src="../styles/channel-status-card.css"></style>
