<script setup lang="ts">
import { useOperatorInbox } from '@frontend/features/manage-operator-inbox/model/use-operator-inbox';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';
import OperatorConversation from './OperatorConversation.vue';
import OperatorRequestList from './OperatorRequestList.vue';

const props = defineProps<{ onUnauthorized: () => void }>();
const inbox = useOperatorInbox(props.onUnauthorized);

defineExpose({ refresh: inbox.refresh });
</script>

<template>
  <AsyncMessage kind="error" :text="inbox.actionError.value" />

  <section
    v-if="inbox.requests.value.length > 0"
    class="card operator-inbox"
    aria-labelledby="operator-inbox-title"
  >
    <header class="operator-inbox-heading">
      <div>
        <p>
          <span class="status-pill status-pill--attention">
            Резервный интерфейс
          </span>
        </p>
        <h2 id="operator-inbox-title">Входящие обращения</h2>
        <p>
          Здесь можно отвечать, если группа операторов в Telegram недоступна.
        </p>
      </div>
      <span class="status-pill status-pill--neutral">
        Активных: {{ inbox.requests.value.length }}
      </span>
    </header>

    <AsyncMessage kind="success" :text="inbox.notice.value" />

    <div class="operator-inbox-layout">
      <OperatorRequestList
        :requests="inbox.requests.value"
        :selected-request-id="inbox.selectedRequestId.value"
        @select="inbox.select"
      />
      <OperatorConversation
        v-if="inbox.selectedRequest.value"
        :key="inbox.selectedRequest.value.id"
        :action-pending="inbox.actionPending.value"
        :messages="inbox.messages.value"
        :on-close="inbox.close"
        :on-reply="inbox.reply"
        :request="inbox.selectedRequest.value"
      />
    </div>
  </section>
</template>

<style scoped src="../styles/operator-inbox.css"></style>
