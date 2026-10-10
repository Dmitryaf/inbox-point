<script setup lang="ts">
import type { ContentDraft } from '@frontend/entities/content/model/types';
import CoreSectionsFields from '@frontend/entities/content/ui/CoreSectionsFields.vue';
import CustomSectionsEditor from '@frontend/entities/content/ui/CustomSectionsEditor.vue';
import FaqEditor from '@frontend/entities/content/ui/FaqEditor.vue';
import ClassScheduleEditor from '@frontend/entities/content/ui/ClassScheduleEditor.vue';
import type { EditorSection } from '@frontend/widgets/content-workspace/model/navigation';

const draft = defineModel<ContentDraft>({ required: true });
defineProps<{
  activeSection: EditorSection;
  errors: Readonly<Record<string, string | undefined>>;
}>();
</script>

<template>
  <div class="editor">
    <ClassScheduleEditor v-show="activeSection === 'core'" v-model="draft" />
    <div v-show="activeSection === 'faq'">
      <CoreSectionsFields v-model="draft" :errors="errors" />
      <FaqEditor v-model="draft" :errors="errors" />
    </div>
    <CustomSectionsEditor
      v-show="activeSection === 'custom'"
      v-model="draft.customSections"
      :errors="errors"
    />
  </div>
</template>

<style scoped src="../styles/content-editor.css"></style>
