<script setup lang="ts">
import { computed } from 'vue';

import { getCoreResponseLengths } from '@frontend/entities/content/lib/content-response-limit';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import FieldError from '@frontend/shared/ui/FieldError.vue';
import SectionVisibilityControl from '@frontend/entities/content/ui/SectionVisibilityControl.vue';

const draft = defineModel<ContentDraft>({ required: true });
withDefaults(
  defineProps<{ errors?: Readonly<Record<string, string | undefined>> }>(),
  { errors: () => ({}) },
);
const responseLengths = computed(() => getCoreResponseLengths(draft.value));
</script>

<template>
  <section class="card">
    <p class="step">Основные разделы</p>
    <h2>Расписание, цены и адрес</h2>

    <details class="field-group" open>
      <summary>
        <span class="summary-copy">
          <strong>Расписание</strong>
          <span class="summary-action summary-action--open">
            Открыть настройки раздела
          </span>
          <span class="summary-action summary-action--close">
            Скрыть настройки раздела
          </span>
        </span>
        <span class="summary-meta">
          <small>{{
            draft.schedule.trim() ? 'Заполнено' : 'Не заполнено'
          }}</small>
          <span class="disclosure-chevron" aria-hidden="true" />
        </span>
      </summary>
      <label for="schedule">Текст ответа</label>
      <textarea
        id="schedule"
        v-model="draft.schedule"
        :aria-describedby="errors.schedule ? 'schedule-error' : undefined"
        :aria-invalid="Boolean(errors.schedule)"
        maxlength="4000"
        rows="5"
      />
      <FieldError id="schedule-error" :text="errors.schedule" />
      <p
        class="counter"
        :class="{ 'counter--error': responseLengths.schedule > 4000 }"
      >
        Итоговый ответ: {{ responseLengths.schedule }} / 4000
      </p>
      <SectionVisibilityControl
        v-model="draft.visibleSections"
        :content-present="Boolean(draft.schedule.trim())"
        section="schedule"
      />
    </details>

    <details class="field-group">
      <summary>
        <span class="summary-copy">
          <strong>Цены</strong>
          <span class="summary-action summary-action--open">
            Открыть настройки раздела
          </span>
          <span class="summary-action summary-action--close">
            Скрыть настройки раздела
          </span>
        </span>
        <span class="summary-meta">
          <small>{{
            draft.prices.trim() ? 'Заполнено' : 'Не заполнено'
          }}</small>
          <span class="disclosure-chevron" aria-hidden="true" />
        </span>
      </summary>
      <label for="prices">Текст ответа</label>
      <textarea
        id="prices"
        v-model="draft.prices"
        :aria-describedby="errors.prices ? 'prices-error' : undefined"
        :aria-invalid="Boolean(errors.prices)"
        maxlength="4000"
        rows="5"
      />
      <FieldError id="prices-error" :text="errors.prices" />
      <p
        class="counter"
        :class="{ 'counter--error': responseLengths.prices > 4000 }"
      >
        Итоговый ответ: {{ responseLengths.prices }} / 4000
      </p>
      <SectionVisibilityControl
        v-model="draft.visibleSections"
        :content-present="Boolean(draft.prices.trim())"
        section="prices"
      />
    </details>

    <details class="field-group">
      <summary>
        <span class="summary-copy">
          <strong>Адрес</strong>
          <span class="summary-action summary-action--open">
            Открыть настройки раздела
          </span>
          <span class="summary-action summary-action--close">
            Скрыть настройки раздела
          </span>
        </span>
        <span class="summary-meta">
          <small>{{
            draft.address.trim() ? 'Заполнено' : 'Не заполнено'
          }}</small>
          <span class="disclosure-chevron" aria-hidden="true" />
        </span>
      </summary>
      <label for="address">Текст ответа</label>
      <textarea
        id="address"
        v-model="draft.address"
        :aria-describedby="errors.address ? 'address-error' : undefined"
        :aria-invalid="Boolean(errors.address)"
        maxlength="4000"
        rows="4"
      />
      <FieldError id="address-error" :text="errors.address" />
      <p
        class="counter"
        :class="{ 'counter--error': responseLengths.address > 4000 }"
      >
        Итоговый ответ: {{ responseLengths.address }} / 4000
      </p>
      <SectionVisibilityControl
        v-model="draft.visibleSections"
        :content-present="Boolean(draft.address.trim())"
        section="address"
      />
    </details>
  </section>
</template>

<style scoped src="../styles/core-sections-fields.css"></style>
