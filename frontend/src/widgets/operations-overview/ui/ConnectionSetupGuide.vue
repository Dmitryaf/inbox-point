<script setup lang="ts">
import AppIcon from '@frontend/shared/ui/AppIcon.vue';

defineProps<{
  problems: readonly {
    action: string;
    channel: 'Telegram' | 'VK';
  }[];
}>();
</script>

<template>
  <section class="connection-guide" aria-labelledby="connection-guide-title">
    <header class="connection-guide-heading">
      <span class="connection-guide-icon" aria-hidden="true">
        <AppIcon name="channel" />
      </span>
      <div>
        <h3 id="connection-guide-title">
          {{
            problems.length > 1
              ? 'Подключите каналы по порядку'
              : 'Подключите канал'
          }}
        </h3>
        <p v-if="problems.length > 1">
          Сначала настройте Telegram — там будут работать операторы. Затем
          подключите VK как второй канал для клиентов.
        </p>
        <p v-else>Ниже указан оставшийся шаг и то, что потребуется.</p>
      </div>
    </header>

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
      На следующей странице будут подробные шаги. Команды сервера и ручной поиск
      идентификаторов не понадобятся.
    </p>
  </section>
</template>

<style scoped src="../styles/connection-setup-guide.css"></style>
