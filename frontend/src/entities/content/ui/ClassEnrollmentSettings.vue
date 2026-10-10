<script setup lang="ts">
import { ref } from 'vue';
import type {
  ClassDirection,
  ClassGroup,
} from '@core/application/class-content';
import { classEnrollmentIssue } from '@frontend/entities/content/model/class-enrollment';
const group = defineModel<ClassGroup>({ required: true });
const props = defineProps<{
  directions: ClassDirection[];
  groups: ClassGroup[];
}>();
const notice = ref('');
function changeEnrollment(event: Event): void {
  const input = event.target as HTMLInputElement;
  notice.value = input.checked
    ? (classEnrollmentIssue(props, group.value) ?? '')
    : '';
  if (!notice.value) {
    if (input.checked) {
      delete group.value.review;
    }
    group.value.enrollmentOpen = input.checked;
  }
  input.checked = group.value.enrollmentOpen;
}
</script>
<template>
  <section class="class-card" aria-label="Запись в группу">
    <h3>Запись в группу</h3>
    <label class="class-check">
      <input
        :checked="group.enrollmentOpen"
        type="checkbox"
        @change="changeEnrollment"
      />
      Открыть набор в группу
    </label>
    <p v-if="notice" role="alert">{{ notice }}</p>
    <p>
      Включите набор — в карточке этой группы бот покажет кнопку «Записаться на
      занятие». При закрытом наборе этой кнопки нет.
    </p>
    <div v-show="group.enrollmentOpen">
      <label :for="'group-question-' + group.id"
        >Вопрос клиенту для записи</label
      >
      <textarea
        :id="'group-question-' + group.id"
        v-model="group.applicationQuestion"
        rows="2"
        maxlength="1000"
        placeholder="Как к вам обращаться и на какое занятие планируете прийти?"
      />
      <p class="class-hint">
        После нажатия кнопки бот задаст этот вопрос. Ответ клиента придёт
        администратору вместе с названием группы. Вы сможете подтвердить место.
      </p>
    </div>
  </section>
</template>
<style scoped src="../styles/class-editor.css"></style>
