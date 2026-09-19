<script setup lang="ts">
import { computed } from 'vue';

import { formatListResponse } from '@frontend/entities/content/lib/client-response-preview';
import { normalizeScheduleItems } from '@frontend/entities/content/lib/schedule-response';
import { getCoreResponseLengths } from '@frontend/entities/content/lib/content-response-limit';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import SectionVisibilityControl from './SectionVisibilityControl.vue';
import ScheduleItemFields from './ScheduleItemFields.vue';

const draft = defineModel<ContentDraft>({ required: true });
const props = withDefaults(
  defineProps<{ errors?: Readonly<Record<string, string | undefined>> }>(),
  { errors: () => ({}) },
);
const itemLimit = 20;
const responseLength = computed(
  () => getCoreResponseLengths(draft.value).schedule,
);
const hasContent = computed(
  () =>
    normalizeScheduleItems(draft.value.schedule).length > 0 ||
    Boolean(draft.value.legacySchedule.trim()),
);
const legacyResponse = computed(() =>
  draft.value.legacySchedule.trim()
    ? formatListResponse('Расписание', draft.value.legacySchedule)
    : '',
);

function add(): void {
  if (draft.value.schedule.length < itemLimit) {
    draft.value.schedule.push({ dayTime: '', title: '' });
  }
}
</script>

<template>
  <details class="field-group" open>
    <summary>
      <span class="summary-copy"><strong>Расписание</strong></span>
      <span class="summary-meta">
        <small>{{ hasContent ? 'Заполнено' : 'Не заполнено' }}</small>
        <span class="disclosure-chevron" aria-hidden="true" />
      </span>
    </summary>

    <div class="section-heading">
      <p>Направления и группы показываются в этом порядке.</p>
      <span>{{ draft.schedule.length }} / {{ itemLimit }}</span>
    </div>
    <p
      class="counter"
      :class="{ 'counter--error': responseLength > 4000 }"
      aria-live="polite"
    >
      Итоговый ответ: {{ responseLength }} / 4000
    </p>
    <SectionVisibilityControl
      v-model="draft.visibleSections"
      :content-present="hasContent"
      section="schedule"
    />

    <aside v-if="draft.legacySchedule" class="legacy-schedule">
      <strong>Сохранён старый текст расписания</strong>
      <p>
        Перенесите его в карточки вручную. Пока заполненных карточек нет, при
        сохранении старый текст останется без изменений.
      </p>
      <pre id="legacy-schedule">{{ legacyResponse }}</pre>
    </aside>

    <p v-if="draft.schedule.length === 0" class="empty">
      Добавьте направление или группу, чтобы создать структурированное
      расписание.
    </p>
    <ScheduleItemFields
      v-for="index in draft.schedule.length"
      :key="index"
      v-model="draft"
      :errors="props.errors"
      :index="index - 1"
    />
    <button
      :disabled="draft.schedule.length >= itemLimit"
      type="button"
      @click="add"
    >
      Добавить направление
    </button>
  </details>
</template>

<style scoped src="../styles/schedule-editor.css"></style>
