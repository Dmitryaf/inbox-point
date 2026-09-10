<script setup lang="ts">
defineProps<{ id: string; text: string | undefined }>();
</script>

<template>
  <p v-if="text" :id="id" class="field-error" role="alert">{{ text }}</p>
</template>

<style scoped src="../styles/field-error.css"></style>
