<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import ClassDirectionEditor from './ClassDirectionEditor.vue';
import ClassGroupEditor from './ClassGroupEditor.vue';
import ClassDirectionList from './ClassDirectionList.vue';
const draft = defineModel<ContentDraft>({ required: true });
const directionId = ref('');
const groupId = ref('');
const reviewing = ref(false);
const direction = computed(() =>
  draft.value.directions.find((item) => item.id === directionId.value),
);
const group = computed(() =>
  draft.value.groups.find((item) => item.id === groupId.value),
);
async function open(
  targetType: 'direction' | 'group',
  targetId: string,
): Promise<void> {
  groupId.value = targetType === 'group' ? targetId : '';
  directionId.value =
    targetType === 'direction'
      ? targetId
      : (draft.value.groups.find((item) => item.id === targetId)?.directionId ??
        '');
  await nextTick();
  document.getElementById('class-directions')?.focus();
}
function back(): void {
  if (group.value) {
    groupId.value = '';
  } else {
    directionId.value = '';
    reviewing.value = false;
  }
}
</script>
<template>
  <section class="card class-workspace" aria-label="Занятия">
    <button
      v-if="direction || group || reviewing"
      class="secondary-button"
      type="button"
      @click="back"
    >
      {{
        group && direction
          ? 'К направлению «' + direction.name + '»'
          : 'Все направления'
      }}
    </button>
    <h2 id="class-directions" tabindex="-1">
      {{
        group
          ? (direction?.name ?? 'Нужно проверить') +
            ' → ' +
            (group.name || 'Занятие')
          : (direction?.name ?? (reviewing ? 'Нужно проверить' : 'Занятия'))
      }}
    </h2>
    <ClassGroupEditor
      v-if="group"
      :key="group.id"
      v-model="draft"
      :group-id="group.id"
      @open-target="open"
      @removed="groupId = ''"
    />
    <ClassDirectionEditor
      v-else-if="direction"
      :key="direction.id"
      v-model="draft"
      :direction-id="direction.id"
      @open-target="open"
      @removed="directionId = ''"
    />
    <ClassDirectionList
      v-else
      v-model="draft"
      v-model:reviewing="reviewing"
      @open-target="open"
    />
  </section>
</template>
<style scoped src="../styles/class-editor.css"></style>
