<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import AdminLoginPage from '@frontend/pages/admin-login/ui/AdminLoginPage.vue';
import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage.vue';
import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage.vue';
import SetupPage from '@frontend/pages/setup/ui/SetupPage.vue';

const currentPath = ref(window.location.pathname);

const currentPage = computed(() => {
  if (currentPath.value === '/login') {
    return AdminLoginPage;
  }
  if (currentPath.value.startsWith('/ops')) {
    return OperationsDashboardPage;
  }
  if (currentPath.value.startsWith('/setup')) {
    return SetupPage;
  }
  return ContentManagementPage;
});

const currentTitle = computed(() => {
  if (currentPath.value === '/login') {
    return 'Вход в управление — Messenger Handoff';
  }
  if (currentPath.value.startsWith('/ops')) {
    return 'Состояние — Messenger Handoff';
  }
  if (currentPath.value.startsWith('/setup')) {
    return 'Каналы — Messenger Handoff';
  }
  return 'Информация — Messenger Handoff';
});

watch(currentTitle, (title) => (document.title = title), { immediate: true });

function updateCurrentPath(): void {
  currentPath.value = window.location.pathname;
}

onMounted(() => window.addEventListener('popstate', updateCurrentPath));
onBeforeUnmount(() =>
  window.removeEventListener('popstate', updateCurrentPath),
);
</script>

<template>
  <component :is="currentPage" />
</template>
