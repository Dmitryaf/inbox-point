<script setup lang="ts">
defineProps<{
  problems: readonly {
    action: string;
    channel: 'Telegram' | 'VK';
  }[];
}>();
</script>

<template>
  <section class="connection-guide" aria-label="Порядок подключения">
    <ol class="connection-guide-steps">
      <li v-for="(problem, index) in problems" :key="problem.channel">
        <span class="connection-step-number">{{ index + 1 }}</span>
        <div>
          <strong>{{ problem.channel }}</strong>
          <p>{{ problem.action }}</p>
        </div>
        <span class="connection-step-status">Не подключён</span>
      </li>
    </ol>

    <RouterLink class="connection-guide-action" to="/setup">
      Начать подключение
    </RouterLink>
    <p class="connection-guide-note">
      На странице «Каналы» указаны шаги для владельца подключения. Для Telegram
      потребуется токен бота, для VK — ключ доступа сообщества.
    </p>
  </section>
</template>

<style scoped src="../styles/connection-setup-guide.css"></style>
