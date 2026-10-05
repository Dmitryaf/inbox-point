<script setup lang="ts">
import { computed } from 'vue';

import type {
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend/entities/operations/model/types';
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

const props = defineProps<{
  actionPending: boolean;
  messages: readonly OperatorInboxMessage[];
  messagesLoading: boolean;
  messagesError: string;
  messagesReady: boolean;
  draft: string;
  onClose: () => Promise<void>;
  onReply: (text: string) => Promise<boolean>;
  request: OperatorInboxRequest;
}>();
const emit = defineEmits<{
  draft: [requestId: string, text: string];
  retry: [];
}>();
const replyText = computed({
  get: () => props.draft,
  set: (text: string) => emit('draft', props.request.id, text),
});

async function submitReply(): Promise<void> {
  await props.onReply(replyText.value);
}

async function closeRequest(): Promise<void> {
  if (
    window.confirm(
      'Закрыть обращение? Чтобы обратиться снова, клиенту нужно будет выбрать «Задать вопрос» и написать сообщение.',
    )
  ) {
    await props.onClose();
  }
}

function deliveryLabel(message: OperatorInboxMessage): string | undefined {
  if (message.deliveryStatus === 'sent') {
    return 'Доставлен';
  }
  if (message.deliveryStatus === 'pending') {
    return 'Готовится к отправке';
  }
  if (message.deliveryStatus === 'failed') {
    return message.deliveryOutcomeUnknown
      ? 'Нужно проверить доставку'
      : 'Не доставлен';
  }
  return undefined;
}
</script>

<template>
  <article class="operator-conversation" aria-label="Выбранное обращение">
    <header class="operator-conversation-heading">
      <div>
        <h3>{{ request.displayName || 'Без имени' }}</h3>
        <p>{{ request.channel === 'telegram' ? 'Telegram' : 'VK' }}</p>
      </div>
      <button
        class="secondary-button"
        type="button"
        :disabled="actionPending || !messagesReady"
        @click="closeRequest"
      >
        Закрыть обращение
      </button>
    </header>

    <p v-if="messagesLoading" role="status">Загружаем переписку…</p>
    <div v-else-if="messagesError">
      <AsyncMessage kind="error" :text="messagesError" />
      <button type="button" class="secondary-button" @click="emit('retry')">
        Повторить загрузку переписки
      </button>
    </div>
    <ol
      v-if="messages.length"
      class="operator-message-list"
      aria-label="Переписка"
      tabindex="0"
    >
      <li
        v-for="message in messages"
        :key="message.id"
        class="operator-message"
        :class="`operator-message--${message.direction}`"
      >
        <div class="operator-message-meta">
          <strong>
            {{
              message.direction === 'client_to_operator'
                ? message.senderName || 'Отправитель'
                : 'Администратор'
            }}
          </strong>
          <time :datetime="message.createdAt">
            {{ formatShortDateTime(message.createdAt) }}
          </time>
        </div>
        <p>{{ message.text }}</p>
        <span
          v-if="deliveryLabel(message)"
          class="operator-message-delivery"
          :class="{
            'operator-message-delivery--failed':
              message.deliveryStatus === 'failed',
          }"
        >
          {{ deliveryLabel(message) }}
        </span>
      </li>
    </ol>
    <p v-else-if="messagesReady" class="operator-inbox-empty">
      Сообщений пока нет.
    </p>

    <form class="operator-reply-form" @submit.prevent="submitReply">
      <label for="operator-reply">Ответ</label>
      <textarea
        id="operator-reply"
        v-model="replyText"
        maxlength="4000"
        required
        rows="4"
        :disabled="actionPending"
      />
      <div class="operator-reply-actions">
        <span>{{ replyText.length }} / 4000</span>
        <button
          type="submit"
          :disabled="actionPending || !messagesReady || !replyText.trim()"
        >
          {{ actionPending ? 'Готовим к отправке…' : 'Отправить' }}
        </button>
      </div>
    </form>
  </article>
</template>

<style scoped src="../styles/operator-conversation.css"></style>
