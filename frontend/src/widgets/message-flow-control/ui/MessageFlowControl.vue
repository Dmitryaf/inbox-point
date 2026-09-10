<script setup lang="ts">
import { useTemplateRef } from 'vue';

import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl.vue';
import OutboundDeliveryControl from '@frontend/features/control-outbound-delivery/ui/OutboundDeliveryControl.vue';

defineProps<{
  outbound: OperationsStatus['outbound'];
  outboundPending: 'pause' | 'resume' | undefined;
}>();
const emit = defineEmits<{
  changed: [];
  changeDeliveryMode: [mode: 'pause' | 'resume'];
  unauthorized: [];
}>();
const intakeControl = useTemplateRef<{ refresh: () => Promise<string> }>(
  'intakeControl',
);

defineExpose({
  refresh: () => intakeControl.value?.refresh() ?? Promise.resolve(''),
});
</script>

<template>
  <details class="message-flow-control card">
    <summary class="message-flow-summary">
      <div>
        <p class="eyebrow">Потоки сообщений</p>
        <h2>Управление сообщениями</h2>
      </div>
      <div class="message-flow-summary-meta">
        <span class="message-flow-summary-action">
          <span class="message-flow-action--open">Открыть управление</span>
          <span class="message-flow-action--close">Скрыть управление</span>
        </span>
        <span class="disclosure-chevron" aria-hidden="true" />
      </div>
    </summary>

    <div class="message-flow-body">
      <ClientIntakeControl
        ref="intakeControl"
        @changed="emit('changed')"
        @unauthorized="emit('unauthorized')"
      />
      <section
        class="message-flow-outbound"
        aria-labelledby="outbound-flow-title"
      >
        <p class="eyebrow">Оператор → клиент</p>
        <h3 id="outbound-flow-title">Ответы клиентам</h3>
        <OutboundDeliveryControl
          :outbound="outbound"
          :pending="outboundPending"
          @change="$emit('changeDeliveryMode', $event)"
        />
      </section>
    </div>
  </details>
</template>

<style scoped src="../styles/message-flow-control.css"></style>
