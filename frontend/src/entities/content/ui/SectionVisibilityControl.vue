<script setup lang="ts">
import type { InformationSectionId } from '@frontend/entities/content/model/types';

const visibleSections = defineModel<InformationSectionId[]>({ required: true });
const props = defineProps<{
  contentPresent: boolean;
  section: InformationSectionId;
}>();

function updateVisibility(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  if (input.checked) {
    if (!visibleSections.value.includes(props.section)) {
      visibleSections.value.push(props.section);
    }
    return;
  }

  visibleSections.value = visibleSections.value.filter(
    (section) => section !== props.section,
  );
}
</script>

<template>
  <label class="visibility-control">
    <input
      :checked="visibleSections.includes(section)"
      type="checkbox"
      @change="updateVisibility"
    />
    <span>
      Показывать кнопку в каналах
      <small v-if="!contentPresent">
        Пустой раздел всё равно не появится в меню.
      </small>
    </span>
  </label>
</template>

<style scoped src="../styles/section-visibility-control.css"></style>
