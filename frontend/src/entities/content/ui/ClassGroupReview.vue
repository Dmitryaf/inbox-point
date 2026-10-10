<script setup lang="ts">
import { normalizeClassDraft } from '@frontend/entities/content/model/class-editor';
import { ref } from 'vue';
import type {
  ClassGroup,
  ClassDirection,
} from '@core/application/class-content';
import { classContentIssue } from '@core/application/class-content';
const group = defineModel<ClassGroup>({ required: true });
const props = defineProps<{
  directions: ClassDirection[];
  groups: ClassGroup[];
}>();
const notice = ref('');
function confirm(directions: ClassDirection[]): void {
  const candidate = { ...group.value };
  delete candidate.review;
  const issue = classContentIssue(
    normalizeClassDraft({
      directions,
      groups: props.groups.map((item) =>
        item.id === candidate.id ? candidate : item,
      ),
    }),
    [],
  );
  if (issue) {
    notice.value =
      'Укажите направление, название группы и расписание. Затем подтвердите данные.';
    return;
  }
  if (
    !window.confirm('Все сведения из исходной записи перенесены в поля группы?')
  ) {
    return;
  }
  delete group.value.review;
  notice.value = '';
}
</script>
<template>
  <aside v-if="group.review" class="class-review">
    <strong>Нужно проверить</strong>
    <p>
      Проверьте исходную запись и заполните поля группы ниже. До подтверждения
      клиентам доступен этот текст, без записи на занятие.
    </p>
    <pre>{{ group.review.source }}</pre>
    <label :for="'review-direction-' + group.id">Направление</label>
    <select :id="'review-direction-' + group.id" v-model="group.directionId">
      <option value="">Выберите направление</option>
      <option v-for="item in directions" :key="item.id" :value="item.id">
        {{ item.name }}
      </option>
    </select>
    <p v-if="!directions.length">
      Сначала добавьте направление на экране «Занятия».
    </p>
    <button type="button" @click="confirm(directions)">
      Подтвердить данные
    </button>
    <p v-if="notice" role="status">{{ notice }}</p>
  </aside>
</template>
<style scoped src="../styles/class-editor.css"></style>
