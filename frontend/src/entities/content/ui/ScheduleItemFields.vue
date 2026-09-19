<script setup lang="ts">
import { computed } from 'vue';

import type { ContentDraft } from '@frontend/entities/content/model/types';
import FieldError from '@frontend/shared/ui/FieldError.vue';

const draft = defineModel<ContentDraft>({ required: true });
const props = defineProps<{
  errors: Readonly<Record<string, string | undefined>>;
  index: number;
}>();
const item = computed(() => draft.value.schedule[props.index]!);

function move(offset: -1 | 1): void {
  const target = props.index + offset;
  if (target < 0 || target >= draft.value.schedule.length) {
    return;
  }
  const [moved] = draft.value.schedule.splice(props.index, 1);
  if (moved) {
    draft.value.schedule.splice(target, 0, moved);
  }
}
</script>

<template>
  <fieldset class="item-card">
    <legend>Направление {{ index + 1 }}</legend>
    <label :for="`schedule-title-${index}`">Направление / группа</label>
    <input
      :id="`schedule-title-${index}`"
      v-model="item.title"
      :aria-describedby="
        errors[`schedule-title-${index}`]
          ? `schedule-title-${index}-error`
          : undefined
      "
      :aria-invalid="Boolean(errors[`schedule-title-${index}`])"
      maxlength="120"
      required
    />
    <FieldError
      :id="`schedule-title-${index}-error`"
      :text="errors[`schedule-title-${index}`]"
    />
    <p class="counter">{{ item.title.length }} / 120</p>

    <label :for="`schedule-day-time-${index}`">День / время</label>
    <input
      :id="`schedule-day-time-${index}`"
      v-model="item.dayTime"
      :aria-describedby="
        errors[`schedule-day-time-${index}`]
          ? `schedule-day-time-${index}-error`
          : undefined
      "
      :aria-invalid="Boolean(errors[`schedule-day-time-${index}`])"
      maxlength="120"
      required
    />
    <FieldError
      :id="`schedule-day-time-${index}-error`"
      :text="errors[`schedule-day-time-${index}`]"
    />
    <p class="counter">{{ item.dayTime.length }} / 120</p>

    <label :for="`schedule-description-${index}`">
      Дополнительное описание
    </label>
    <textarea
      :id="`schedule-description-${index}`"
      v-model="item.description"
      :aria-describedby="
        errors[`schedule-description-${index}`]
          ? `schedule-description-${index}-error`
          : undefined
      "
      :aria-invalid="Boolean(errors[`schedule-description-${index}`])"
      maxlength="1000"
      rows="3"
    />
    <FieldError
      :id="`schedule-description-${index}-error`"
      :text="errors[`schedule-description-${index}`]"
    />
    <p class="counter">{{ item.description?.length ?? 0 }} / 1000</p>

    <div class="item-actions">
      <button
        class="quiet"
        type="button"
        :disabled="index === 0"
        :aria-label="`Переместить направление ${index + 1} выше`"
        @click="move(-1)"
      >
        Выше
      </button>
      <button
        class="quiet"
        type="button"
        :disabled="index === draft.schedule.length - 1"
        :aria-label="`Переместить направление ${index + 1} ниже`"
        @click="move(1)"
      >
        Ниже
      </button>
      <button
        class="danger"
        type="button"
        @click="draft.schedule.splice(index, 1)"
      >
        Удалить
      </button>
    </div>
  </fieldset>
</template>

<style scoped src="../styles/collection-editor.css"></style>
