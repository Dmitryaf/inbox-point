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
  <article
    class="analytics-overview"
    aria-live="polite"
    aria-label="Отчёт об использовании"
  >
    <header class="analytics-summary">
      <h2>Использование за период</h2>
      <dl class="usage-totals">
        <div>
          <dt>Обращения</dt>
          <dd class="metric-value">{{ report.summary.requests }}</dd>
        </div>
        <div>
          <dt>Выборы в меню</dt>
          <dd class="metric-value">{{ report.summary.menuActions }}</dd>
        </div>
      </dl>
      <dl
        v-if="report.channel === 'all'"
        class="usage-channels"
        aria-label="Использование каналов"
      >
        <div v-for="(counts, channel) in report.channels" :key="channel">
          <dt>{{ channel === 'telegram' ? 'Telegram' : 'VK' }}</dt>
          <dd>
            Обращения: {{ counts.requests }} · Выборы в меню:
            {{ counts.menuActions }}
          </dd>
        </div>
      </dl>
    </header>
    <div class="analytics-reading">
      <section class="menu-usage" aria-labelledby="menu-usage-title">
        <h2 id="menu-usage-title">Что выбирают в меню</h2>
        <p v-if="!report.actions.length" class="muted">
          За этот период действий меню пока нет.
        </p>
        <table v-else class="analytics-table">
          <thead>
            <tr>
              <th scope="col">Действие</th>
              <th scope="col">Всего</th>
              <th
                v-if="report.channel === 'all'"
                scope="col"
                aria-label="Telegram"
              >
                <span class="channel-name-full">Telegram</span>
                <abbr class="channel-name-short" title="Telegram">TG</abbr>
              </th>
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
      </section>
      <section
        class="question-context"
        aria-labelledby="question-context-title"
      >
        <h2 id="question-context-title">Кнопки для вопросов</h2>
        <dl class="question-path">
          <div>
            <dt>Выборы «Задать вопрос» и «Начать новый вопрос»</dt>
            <dd>{{ questionChoices }}</dd>
          </div>
        </dl>
        <p v-if="lastRequest" class="muted">
          Последнее за период: {{ lastRequest }}
        </p>
        <p v-else class="muted">За этот период обращений пока нет.</p>
      </section>
    </div>
    <AnalyticsActivity :daily="report.daily" />
  </article>
</template>
<style scoped src="../styles/analytics-overview.css"></style>
