<script setup lang="ts">
import { ref } from 'vue';

import type {
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend/entities/operations/model/types';

const props = defineProps<{
  actionPending: boolean;
  messages: readonly OperatorInboxMessage[];
  onClose: () => Promise<void>;
  onReply: (text: string) => Promise<boolean>;
  request: OperatorInboxRequest;
}>();
const replyText = ref('');

async function submitReply(): Promise<void> {
  if (await props.onReply(replyText.value)) {
    replyText.value = '';
  }
}

async function closeRequest(): Promise<void> {
  if (
    window.confirm(
      'Закрыть обращение? Следующее новое сообщение создаст новое обращение.',
    )
  ) {
    await props.onClose();
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function deliveryLabel(message: OperatorInboxMessage): string | undefined {
  if (message.deliveryStatus === 'sent') {
    return 'Доставлен';
  }
  if (message.deliveryStatus === 'pending') {
    return 'В очереди';
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
  <article class="operator-conversation">
    <header class="operator-conversation-heading">
      <div>
        <h3>{{ request.displayName || 'Без имени' }}</h3>
        <p>{{ request.channel === 'telegram' ? 'Telegram' : 'VK' }}</p>
      </div>
      <button
        class="secondary-button"
        type="button"
        :disabled="actionPending"
        @click="closeRequest"
      >
        Закрыть обращение
      </button>
    </header>

    <ol
      v-if="messages.length"
      class="operator-message-list"
      aria-label="Переписка"
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
                : 'Оператор'
            }}
          </strong>
          <time :datetime="message.createdAt">
            {{ formatDate(message.createdAt) }}
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
    <p v-else class="operator-inbox-empty">Сообщений пока нет.</p>

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
        <button type="submit" :disabled="actionPending || !replyText.trim()">
          {{ actionPending ? 'Добавляем в очередь…' : 'Отправить' }}
        </button>
      </div>
    </form>
  </article>
</template>
