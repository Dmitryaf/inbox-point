<script setup lang="ts">
import { computed } from 'vue';
import type { ClassGroup } from '@core/application/class-content';
import { duplicateClassGroup } from '@frontend/entities/content/model/class-enrollment';
const group = defineModel<ClassGroup>({ required: true });
const props = defineProps<{ groups: ClassGroup[] }>();
const emit = defineEmits<{ openGroup: [id: string] }>();
const duplicate = computed(() =>
  duplicateClassGroup(props.groups, group.value),
);
</script>
<template>
  <aside v-if="group.review" class="class-review">
    <strong>Старое расписание</strong>
    <pre>{{ group.review.source }}</pre>
    <p>Заполните название, дни и время занятий ниже, затем включите набор.</p>
    <div v-if="duplicate" role="alert">
      <p>
        Группа «{{ duplicate.name }}» уже есть в этом направлении. Можно открыть
        её или удалить эту лишнюю запись.
      </p>
      <button
        type="button"
        class="secondary-button"
        @click="emit('openGroup', duplicate.id)"
      >
        Открыть существующую группу
      </button>
    </div>
  </aside>
</template>
<style scoped src="../styles/class-editor.css"></style>
