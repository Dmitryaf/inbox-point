<script setup lang="ts">
import { useClientIntakeControl } from '@frontend/features/control-client-intake/model/use-client-intake-control';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';
import ChannelIntakeControls from './ChannelIntakeControls.vue';

const emit = defineEmits<{
  changed: [];
  unauthorized: [];
}>();
const control = useClientIntakeControl({
  onChanged: () => emit('changed'),
  onUnauthorized: () => emit('unauthorized'),
});
defineExpose({ refresh: control.load });
</script>

<template>
  <section class="client-intake-control" aria-labelledby="intake-flow-title">
    <p class="eyebrow">Клиент → оператор</p>
    <h3 id="intake-flow-title">Новые обращения</h3>
    <p class="intake-control-intro">
      Пауза действует отдельно для Telegram и VK. Текущие обращения продолжат
      работать.
    </p>
    <AsyncMessage kind="error" :text="control.actionError.value" />
    <AsyncMessage kind="success" :text="control.notice.value" />
    <p v-if="control.loading.value" class="intake-control-state" role="status">
      Проверяем режим работы…
    </p>
    <ChannelIntakeControls
      v-else-if="control.state.value"
      :pending-channel="control.pendingChannel.value"
      :state="control.state.value"
      @change="control.changeMode"
    />
  </section>
</template>

<style scoped src="../styles/client-intake-control.css"></style>
