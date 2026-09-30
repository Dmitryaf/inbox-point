<script setup lang="ts">
import { computed } from 'vue';
import { normalizeContentDraft } from '@frontend/entities/content/model/content-draft';
import type {
  ContentSnapshot,
  InformationSectionId,
} from '@frontend/entities/content/model/types';

const props = defineProps<{ snapshot: ContentSnapshot }>();
const content = computed(() => normalizeContentDraft(props.snapshot.content));
function visibility(section: InformationSectionId): string {
  return content.value.visibleSections.includes(section)
    ? 'Кнопка включена'
    : 'Скрыто в меню';
}
</script>

<template>
  <div class="revision-content">
    <section>
      <h3>
        Расписание <small>{{ visibility('schedule') }}</small>
      </h3>
      <ul v-if="content.schedule.length">
        <li v-for="(item, index) in content.schedule" :key="index">
          <strong>{{ item.title }}</strong>
          <p>{{ item.dayTime }}</p>
          <p v-if="item.description">{{ item.description }}</p>
        </li>
      </ul>
      <p v-else>{{ content.legacySchedule || 'Не заполнено' }}</p>
    </section>
    <section>
      <h3>
        Цены <small>{{ visibility('prices') }}</small>
      </h3>
      <p>{{ content.prices || 'Не заполнено' }}</p>
    </section>
    <section>
      <h3>
        Адрес <small>{{ visibility('address') }}</small>
      </h3>
      <p>{{ content.address || 'Не заполнено' }}</p>
    </section>
    <section>
      <h3>
        Частые вопросы <small>{{ visibility('faq') }}</small>
      </h3>
      <ul v-if="content.faq.length">
        <li v-for="(item, index) in content.faq" :key="index">
          <strong>{{ item.question }}</strong>
          <p>{{ item.answer }}</p>
        </li>
      </ul>
      <p v-else>Не заполнено</p>
    </section>
    <section>
      <h3>Свои разделы</h3>
      <ul v-if="content.customSections.length">
        <li v-for="(item, index) in content.customSections" :key="index">
          <strong>{{ item.label }}</strong>
          <p>{{ item.text }}</p>
        </li>
      </ul>
      <p v-else>Не заполнено</p>
    </section>
  </div>
</template>

<style scoped src="../styles/content-revision.css"></style>
