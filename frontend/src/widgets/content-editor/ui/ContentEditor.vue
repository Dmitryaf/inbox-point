<script setup lang="ts">
import type { ContentDraft } from '@frontend/entities/content/model/types';
import CoreSectionsFields from '@frontend/entities/content/ui/CoreSectionsFields.vue';
import CustomSectionsEditor from '@frontend/entities/content/ui/CustomSectionsEditor.vue';
import FaqEditor from '@frontend/entities/content/ui/FaqEditor.vue';
import type { EditorSection } from '@frontend/widgets/content-workspace/model/navigation';

const draft = defineModel<ContentDraft>({ required: true });
defineProps<{
  activeSection: EditorSection;
  errors: Readonly<Record<string, string | undefined>>;
}>();
</script>

<template>
  <div class="editor">
    <CoreSectionsFields
      v-if="activeSection === 'core'"
      v-model="draft"
      :errors="errors"
    />
    <FaqEditor
      v-else-if="activeSection === 'faq'"
      v-model="draft"
      :errors="errors"
    />
    <CustomSectionsEditor
      v-else
      v-model="draft.customSections"
      :errors="errors"
    />
  </div>
</template>

<style scoped src="../styles/content-editor.css"></style>
