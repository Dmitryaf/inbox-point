<script setup lang="ts">
import { useCollectionEditor } from '@frontend/entities/content/lib/use-collection-editor';
import type { CustomSection } from '@frontend/entities/content/model/types';
import FieldError from '@frontend/shared/ui/FieldError.vue';

const sections = defineModel<CustomSection[]>({ required: true });
withDefaults(
  defineProps<{ errors?: Readonly<Record<string, string | undefined>> }>(),
  { errors: () => ({}) },
);

const { add, move, remove, itemKey } = useCollectionEditor({
  items: () => sections.value,
  create: () => ({ id: crypto.randomUUID(), label: '', text: '' }),
  limit: 6,
  fieldPrefix: 'section-label',
  description: (item, index) => `раздел «${item.label.trim() || index + 1}»`,
  hasContent: (item) => !!(item.label.trim() || item.text.trim()),
});
</script>

<template>
  <section class="card">
    <div class="section-heading">
      <div>
        <p class="step">Свои кнопки</p>
        <h2>Дополнительные разделы</h2>
      </div>
      <span>{{ sections.length }} / 6</span>
    </div>
    <p v-if="sections.length === 0" class="empty">
      Дополнительных разделов пока нет.
    </p>
    <fieldset
      v-for="(section, index) in sections"
      :key="itemKey(section)"
      class="item-card"
    >
      <legend>Раздел {{ index + 1 }}</legend>
      <label :for="`section-label-${index}`">Название кнопки</label>
      <input
        :id="`section-label-${index}`"
        v-model="section.label"
        :aria-describedby="
          errors[`section-label-${index}`]
            ? `section-label-${index}-error`
            : undefined
        "
        :aria-invalid="Boolean(errors[`section-label-${index}`])"
        maxlength="40"
        required
      />
      <FieldError
        :id="`section-label-${index}-error`"
        :text="errors[`section-label-${index}`]"
      />
      <p class="counter">{{ section.label.length }} / 40</p>
      <label :for="`section-text-${index}`">Текст ответа</label>
      <textarea
        :id="`section-text-${index}`"
        v-model="section.text"
        :aria-describedby="
          errors[`section-text-${index}`]
            ? `section-text-${index}-error`
            : undefined
        "
        :aria-invalid="Boolean(errors[`section-text-${index}`])"
        maxlength="4000"
        required
        rows="4"
      />
      <FieldError
        :id="`section-text-${index}-error`"
        :text="errors[`section-text-${index}`]"
      />
      <p class="counter">{{ section.text.length }} / 4000</p>
      <div class="item-actions">
        <button
          class="quiet"
          type="button"
          :disabled="index === 0"
          :aria-label="`Переместить раздел ${index + 1} выше`"
          data-move="-1"
          @click="move(index, -1)"
        >
          Выше
        </button>
        <button
          class="quiet"
          type="button"
          :disabled="index === sections.length - 1"
          :aria-label="`Переместить раздел ${index + 1} ниже`"
          data-move="1"
          @click="move(index, 1)"
        >
          Ниже
        </button>
        <button class="danger" type="button" @click="remove(index)">
          Удалить раздел
        </button>
      </div>
    </fieldset>
    <button
      id="add-section-label"
      :disabled="sections.length >= 6"
      type="button"
      @click="add"
    >
      Добавить раздел
    </button>
  </section>
</template>

<style scoped src="../styles/collection-editor.css"></style>
