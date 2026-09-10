<script setup lang="ts">
defineProps<{
  kind: 'error' | 'success';
  text: string;
}>();
</script>

<template>
  <p
    v-if="text"
    class="message card"
    :class="kind"
    :role="kind === 'error' ? 'alert' : 'status'"
  >
    {{ text }}
  </p>
</template>

<style scoped src="../styles/async-message.css"></style>
