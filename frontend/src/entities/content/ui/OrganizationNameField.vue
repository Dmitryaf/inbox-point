<script setup lang="ts">
import FieldError from '@frontend/shared/ui/FieldError.vue';
const name = defineModel<string | undefined>();
defineProps<{ error?: string | undefined }>();
</script>

<template>
  <section class="card" aria-label="Организация">
    <label for="organization-name">Название организации</label>
    <input
      id="organization-name"
      v-model="name"
      maxlength="120"
      placeholder="Например, школа танцев"
      autocomplete="organization"
      :aria-invalid="Boolean(error)"
      :aria-describedby="error ? 'organization-name-error' : undefined"
    />
    <FieldError id="organization-name-error" :text="error" />
  </section>
</template>
