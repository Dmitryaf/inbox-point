<script setup lang="ts">
import { useClientIntakeControl } from '@frontend/features/control-client-intake/model/use-client-intake-control';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';
import ChannelIntakeControls from './ChannelIntakeControls.vue';

const emit = defineEmits<{ changed: []; unauthorized: [] }>();
const control = useClientIntakeControl({
  onChanged: () => emit('changed'),
  onUnauthorized: () => emit('unauthorized'),
});
defineExpose({ refresh: control.load });
</script>

<template>
  <details class="intake-control card">
    <summary class="intake-control-summary">
      <div>
        <p class="eyebrow">Управление каналами</p>
        <h2>Новые обращения</h2>
      </div>
      <div class="intake-control-summary-meta">
        <span
          class="intake-summary-status"
          :class="`intake-summary-status--${control.summaryStatus.value.tone}`"
        >
          {{ control.summaryStatus.value.label }}
        </span>
        <span class="intake-summary-action">
          <span class="intake-summary-action--open">Открыть управление</span>
          <span class="intake-summary-action--close">Скрыть управление</span>
        </span>
        <span class="disclosure-chevron" aria-hidden="true" />
      </div>
    </summary>

    <div class="intake-control-body">
      <p class="intake-control-intro">
        Можно приостановить новые обращения из одного канала. Текущие обращения
        продолжат работать.
      </p>
      <AsyncMessage kind="error" :text="control.error.value" />
      <AsyncMessage kind="success" :text="control.notice.value" />
      <button
        v-if="control.error.value && !control.state.value"
        class="secondary-button"
        type="button"
        :disabled="control.loading.value"
        @click="control.load"
      >
        Повторить проверку
      </button>
      <p
        v-if="control.loading.value"
        class="intake-control-state"
        role="status"
      >
        Проверяем режим работы…
      </p>
      <ChannelIntakeControls
        v-else-if="control.state.value"
        :pending-channel="control.pendingChannel.value"
        :state="control.state.value"
        @change="control.changeMode"
      />
    </div>
  </details>
</template>

<style scoped src="./client-intake-control.css"></style>
