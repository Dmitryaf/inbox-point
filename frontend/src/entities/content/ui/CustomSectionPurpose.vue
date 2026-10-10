<script setup lang="ts">
import type { CustomSection } from '@frontend/entities/content/model/types';

const mode = defineModel<CustomSection['mode']>();
defineProps<{ name: string }>();
const purposes = [
  {
    value: 'information',
    label: 'Показать информацию',
    description:
      'Например: «Цены», «Адрес», «Что взять с собой». Нажав кнопку, человек получит готовый ответ.',
  },
  {
    value: 'application',
    label: 'Принять заявку',
    description:
      'Например: «Заказать звонок». Бот спросит нужные детали и передаст ответ администратору.',
  },
] as const;
</script>

<template>
  <div
    class="section-purpose"
    role="radiogroup"
    :aria-labelledby="`${name}-label`"
  >
    <p :id="`${name}-label`" class="purpose-title">Для чего нужна кнопка?</p>
    <label
      v-for="purpose in purposes"
      :key="purpose.value"
      class="purpose-option"
    >
      <input
        type="radio"
        :name="name"
        :value="purpose.value"
        :checked="(mode ?? 'information') === purpose.value"
        @change="mode = purpose.value"
      />
      <span>
        <strong>{{ purpose.label }}</strong>
        <span>{{ purpose.description }}</span>
      </span>
    </label>
  </div>
</template>

<style scoped src="../styles/custom-section-purpose.css"></style>
