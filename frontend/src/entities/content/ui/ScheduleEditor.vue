<script setup lang="ts">
import { computed } from 'vue';
import {
  createItemKey,
  focusEditorField,
} from '@frontend/entities/content/lib/editor-focus';

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
const itemKey = createItemKey();
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
    void focusEditorField(`schedule-title-${draft.value.schedule.length - 1}`);
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
      v-for="(item, index) in draft.schedule"
      :key="itemKey(item)"
      v-model="draft"
      :errors="props.errors"
      :index="index"
    />
    <div class="section-heading">
      <p>Клиенты увидят направления в этом порядке.</p>
      <span>{{ draft.schedule.length }} / {{ itemLimit }}</span>
    </div>
    <button
      id="add-schedule"
      :disabled="draft.schedule.length >= itemLimit"
      type="button"
      @click="add"
    >
      Добавить направление
    </button>
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
  </details>
</template>

<style scoped src="../styles/schedule-editor.css"></style>
