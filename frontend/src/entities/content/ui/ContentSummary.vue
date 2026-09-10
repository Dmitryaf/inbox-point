<script setup lang="ts">
import { computed } from 'vue';

import { isSectionVisible } from '@frontend/entities/content/model/content-draft';
import type { ContentDraft } from '@frontend/entities/content/model/types';
import AppIcon from '@frontend/shared/ui/AppIcon.vue';

const props = defineProps<{ content: ContentDraft }>();

const standardCount = computed(() => {
  const sections = [
    isSectionVisible(props.content, 'schedule') &&
      props.content.schedule.trim(),
    isSectionVisible(props.content, 'prices') && props.content.prices.trim(),
    isSectionVisible(props.content, 'address') && props.content.address.trim(),
    isSectionVisible(props.content, 'faq') && props.content.faq.length > 0,
  ];
  return sections.filter(Boolean).length;
});

const totalCount = computed(
  () => standardCount.value + props.content.customSections.length,
);
</script>

<template>
  <section class="content-summary" aria-labelledby="content-summary-title">
    <div class="summary-heading">
      <div>
        <p>Готовность ответов</p>
        <h3 id="content-summary-title">
          {{ totalCount ? 'Готово к показу' : 'Пока не заполнено' }}
        </h3>
      </div>
    </div>

    <dl class="content-facts">
      <div>
        <dt>Основные кнопки</dt>
        <dd>{{ standardCount }} из 4</dd>
      </div>
      <div>
        <dt>Частые вопросы</dt>
        <dd>{{ content.faq.length }}</dd>
      </div>
      <div>
        <dt>Свои разделы</dt>
        <dd>{{ content.customSections.length }}</dd>
      </div>
    </dl>

    <p class="channel-note">
      <AppIcon name="check" /> После сохранения изменения появятся в Telegram и
      VK.
    </p>
  </section>
</template>

<style scoped src="../styles/content-summary.css"></style>
