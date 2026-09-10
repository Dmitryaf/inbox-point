<script setup lang="ts">
export type AppIconName =
  | 'channel'
  | 'check'
  | 'core'
  | 'custom'
  | 'edit'
  | 'faq'
  | 'history'
  | 'preview';

defineProps<{ name: AppIconName }>();
</script>

<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="1.8"
    aria-hidden="true"
  >
    <template v-if="name === 'edit'">
      <path d="M4 20h4l11-11-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </template>
    <template v-else-if="name === 'preview'">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M4 5v5h5" />
      <path d="M5.5 17.5A8 8 0 1 0 4 10" />
      <path d="M12 8v4l2.5 1.5" />
    </template>
    <template v-else-if="name === 'core'">
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </template>
    <template v-else-if="name === 'faq'">
      <path d="M5 5h14v11H9l-4 3V5Z" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4.8 1c0 1.8-2.3 1.8-2.3 3" />
      <path d="M12 14.7h.01" />
    </template>
    <template v-else-if="name === 'custom'">
      <path d="M12 3v18M3 12h18" />
      <circle cx="12" cy="12" r="8" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12 4 4 10-10" />
    </template>
    <template v-else>
      <path d="M5 7h14v10H5z" />
      <path d="m8 10 4 3 4-3" />
    </template>
  </svg>
</template>

<style scoped src="../styles/app-icon.css"></style>
