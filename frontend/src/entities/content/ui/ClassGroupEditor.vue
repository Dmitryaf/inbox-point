<script setup lang="ts">
import { computed } from 'vue';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import { removeClassGroup } from '@frontend/entities/content/model/class-editor';
import ClassGroupPreview from './ClassGroupPreview.vue';
const draft = defineModel<ContentDraft>({ required: true });
const props = defineProps<{ groupId: string }>();
const group = computed(() =>
  draft.value.groups.find((item) => item.id === props.groupId),
);
const initiallyOpen = !group.value?.name;
function remove(): void {
  if (
    window.confirm(
      'Удалить группу и её ключевые слова? Уже отправленные заявки сохранятся.',
    )
  ) {
    removeClassGroup(draft.value, props.groupId);
  }
}
</script>
<template>
  <details v-if="group" class="class-card" :open="initiallyOpen">
    <summary>
      <strong>{{ group.name || 'Новая группа' }}</strong> ·
      {{ group.enrollmentOpen ? 'Набор открыт' : 'Набор закрыт' }}
    </summary>
    <label :for="`group-name-${group.id}`"> Название группы </label>
    <input
      :id="`group-name-${group.id}`"
      v-model="group.name"
      maxlength="80"
      placeholder="Например, Начинающие"
    />
    <label :for="`group-direction-${group.id}`"> Направление </label>
    <select :id="`group-direction-${group.id}`" v-model="group.directionId">
      <option
        v-for="direction in draft.directions"
        :key="direction.id"
        :value="direction.id"
      >
        {{ direction.name }}
      </option>
    </select>
    <div
      v-for="(_, index) in group.meetings"
      :key="index"
      class="class-meeting"
    >
      <label :for="`group-time-${group.id}-${index}`">
        День и время {{ index + 1 }}
      </label>
      <div class="class-actions">
        <input
          :id="`group-time-${group.id}-${index}`"
          v-model="group.meetings[index]"
          maxlength="120"
          placeholder="Понедельник, 19:00"
        />
        <button
          v-if="group.meetings.length > 1"
          type="button"
          @click="group.meetings.splice(index, 1)"
        >
          Удалить время {{ index + 1 }}
        </button>
      </div>
    </div>
    <button
      type="button"
      :disabled="group.meetings.length >= 7"
      @click="group.meetings.push('')"
    >
      Добавить день и время
    </button>
    <label :for="`group-description-${group.id}`">
      Короткое описание группы
    </label>
    <textarea
      :id="`group-description-${group.id}`"
      v-model="group.description"
      rows="3"
      maxlength="1000"
      placeholder="Кому подойдут занятия и что нужно знать перед первым визитом"
    />
    <label class="class-check">
      <input v-model="group.enrollmentOpen" type="checkbox" />
      Открыть набор в группу
    </label>
    <p>
      При открытом наборе клиент увидит кнопку «Записаться на занятие». После
      его ответа вы получите заявку и сможете подтвердить место.
    </p>
    <label :for="`group-question-${group.id}`">
      Что спросить после нажатия «Записаться»
    </label>
    <textarea
      :id="`group-question-${group.id}`"
      v-model="group.applicationQuestion"
      rows="2"
      maxlength="1000"
    />
    <p>
      Направление и группа уже выбраны. Не просите клиента указывать их снова.
    </p>
    <ClassGroupPreview :content="draft" :group-id="group.id" />
    <button type="button" class="danger" @click="remove">Удалить группу</button>
  </details>
</template>
<style scoped src="../styles/class-editor.css"></style>
