<script setup lang="ts">
import { computed, ref } from 'vue';
import type { UsageDailyCount } from '@core/model/usage-event';
const props = defineProps<{ daily: UsageDailyCount[] }>();
const dailyExpanded = ref(false);
const recentDays = computed(() => [...props.daily].reverse());
const maximum = computed(() =>
  Math.max(1, ...props.daily.flatMap((day) => [day.requests, day.menuActions])),
);
const points = (key: 'requests' | 'menuActions') =>
  props.daily
    .map(
      (day, index) => `${x(index)},${190 - (day[key] / maximum.value) * 160}`,
    )
    .join(' ');
function x(index: number): number {
  return 48 + (index / Math.max(1, props.daily.length - 1)) * 604;
}
const ticks = computed(() =>
  [
    ...new Set([
      0,
      Math.floor((props.daily.length - 1) / 2),
      props.daily.length - 1,
    ]),
  ].filter((index) => index >= 0),
);
function label(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
</script>
<template>
  <section class="analytics-activity" aria-labelledby="activity-title">
    <h2 id="activity-title">Активность по дням</h2>
    <p class="chart-legend">
      <span>━ Выборы в меню</span><span>┄ Обращения</span>
    </p>
    <svg
      class="activity-chart"
      viewBox="0 0 700 225"
      role="img"
      aria-label="Динамика действий меню и обращений. Точные значения доступны в таблице ниже."
    >
      <g v-for="fraction in [0, 0.5, 1]" :key="fraction">
        <line
          x1="48"
          x2="652"
          :y1="190 - fraction * 160"
          :y2="190 - fraction * 160"
          class="grid-line"
        />
        <text x="38" :y="195 - fraction * 160" text-anchor="end">
          {{ Math.round(maximum * fraction) }}
        </text>
      </g>
      <polyline :points="points('menuActions')" class="menu-line" />
      <polyline :points="points('requests')" class="request-line" />
      <text
        v-for="index in ticks"
        :key="index"
        :x="x(index)"
        y="218"
        :text-anchor="
          index === 0 ? 'start' : index === daily.length - 1 ? 'end' : 'middle'
        "
      >
        {{ daily[index] ? label(daily[index]!.date) : '' }}
      </text>
    </svg>
    <button
      class="daily-toggle secondary-button"
      type="button"
      aria-controls="daily-values"
      :aria-expanded="dailyExpanded"
      @click="dailyExpanded = !dailyExpanded"
    >
      {{
        dailyExpanded ? 'Скрыть значения по дням' : 'Показать значения по дням'
      }}
    </button>
    <div
      id="daily-values"
      class="daily-values"
      :class="{ 'daily-values--expanded': dailyExpanded }"
      tabindex="0"
      role="region"
      aria-label="Значения по дням"
    >
      <table class="analytics-table" aria-label="Активность по дням">
        <thead>
          <tr>
            <th scope="col">Дата</th>
            <th scope="col">Меню</th>
            <th scope="col">Обращения</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in recentDays" :key="day.date">
            <th scope="row">{{ label(day.date) }}</th>
            <td>{{ day.menuActions }}</td>
            <td>{{ day.requests }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<style scoped src="../styles/analytics-overview.css"></style>
