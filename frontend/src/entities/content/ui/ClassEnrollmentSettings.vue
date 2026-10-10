<script setup lang="ts">
import type { ClassGroup } from '@core/application/class-content';
const group = defineModel<ClassGroup>({ required: true });
</script>
<template>
  <section class="class-card" aria-label="Запись в группу">
    <h3>Запись в группу</h3>
    <label class="class-check">
      <input
        v-model="group.enrollmentOpen"
        type="checkbox"
        :disabled="Boolean(group.review)"
      />
      Открыть набор в группу
    </label>
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
