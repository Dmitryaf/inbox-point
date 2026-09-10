<script setup lang="ts">
import { useAdminShellSession } from '@frontend/features/admin-auth/model/admin-session-context';
import ContentWorkspace from '@frontend/widgets/content-workspace/ui/ContentWorkspace.vue';

const session = useAdminShellSession();
const emit = defineEmits<{ dirtyChange: [dirty: boolean] }>();
</script>

<template>
  <section class="content-management-page">
    <ContentWorkspace
      :authenticated="session.authenticated.value"
      @dirty-change="emit('dirtyChange', $event)"
      @unauthorized="session.expireSession"
    />
  </section>
</template>

<style scoped src="../styles/content-management-page.css"></style>
