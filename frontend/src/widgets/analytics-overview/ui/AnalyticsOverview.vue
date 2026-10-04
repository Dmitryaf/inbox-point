<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsReport } from '@frontend/entities/analytics/model/types';
import AnalyticsActivity from './AnalyticsActivity.vue';
const props = defineProps<{ report: AnalyticsReport }>();
const questionChoices = computed(() =>
  props.report.actions
    .filter(
      (action) => action.key === 'handoff' || action.key === 'new_question',
    )
    .reduce((sum, action) => sum + action.count, 0),
);
const lastRequest = computed(() =>
  props.report.lastRequestAt
    ? new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date(props.report.lastRequestAt))
    : '',
);
</script>
<template>
  <div class="analytics-overview" aria-live="polite">
    <div class="analytics-summary">
      <section class="card">
        <h2>Обращения</h2>
        <p class="metric-value">{{ report.summary.requests }}</p>
        <p v-if="report.channel === 'all'" class="muted">
          Telegram: {{ report.channels.telegram.requests }} · VK:
          {{ report.channels.vk.requests }}
        </p>
        <p v-if="lastRequest" class="muted">
          Последнее за период: {{ lastRequest }} UTC
        </p>
      </section>
      <section class="card">
        <h2>Выборы в меню</h2>
        <p class="metric-value">{{ report.summary.menuActions }}</p>
        <p v-if="report.channel === 'all'" class="muted">
          Telegram: {{ report.channels.telegram.menuActions }} · VK:
          {{ report.channels.vk.menuActions }}
        </p>
        <p class="muted">
          В Telegram учитывается и ввод текста, совпадающего с действием меню.
        </p>
      </section>
    </div>
    <AnalyticsActivity :daily="report.daily" />
    <section class="card">
      <h2>Популярные действия</h2>
      <p v-if="!report.actions.length" class="muted">
        За этот период действий меню пока нет.
      </p>
      <table v-else class="analytics-table">
        <caption class="muted">
          Действия по частоте выбора
        </caption>
        <thead>
          <tr>
            <th scope="col">Действие</th>
            <th scope="col">Всего</th>
            <th v-if="report.channel === 'all'" scope="col">Telegram</th>
            <th v-if="report.channel === 'all'" scope="col">VK</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="action in report.actions" :key="action.key">
            <th scope="row">{{ action.label }}</th>
            <td>{{ action.count }}</td>
            <td v-if="report.channel === 'all'">{{ action.telegram }}</td>
            <td v-if="report.channel === 'all'">{{ action.vk }}</td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="
          report.actions.some((action) => action.key === 'legacy_information')
        "
        class="muted"
      >
        В старой статистике названия разделов не сохранялись.
      </p>
    </section>
    <section v-if="questionChoices" class="card">
      <h2>Путь до обращения</h2>
      <dl class="question-path">
        <div>
          <dt>Выбрали «Задать вопрос» или «Начать новый вопрос»</dt>
          <dd>{{ questionChoices }}</dd>
        </div>
        <div>
          <dt>Создали обращение</dt>
          <dd>{{ report.summary.requests }}</dd>
        </div>
      </dl>
      <p class="muted">
        Это отдельные счётчики действий, без сопоставления людей. Обращение
        можно создать и первым сообщением.
      </p>
    </section>
  </div>
</template>
<style scoped src="../styles/analytics-overview.css"></style>
