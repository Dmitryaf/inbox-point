<script setup lang="ts">
import ProductLogo from '@frontend/shared/ui/ProductLogo.vue';

export type AdminSection = 'answers' | 'channels' | 'monitoring';

defineProps<{
  current: AdminSection;
  intro: string;
  showLogout: boolean;
  title: string;
}>();
defineEmits<{ logout: [] }>();

const sections: readonly {
  href: string;
  id: AdminSection;
  label: string;
}[] = [
  { href: '/manage', id: 'answers', label: 'Ответы' },
  { href: '/setup', id: 'channels', label: 'Каналы' },
  { href: '/ops', id: 'monitoring', label: 'Мониторинг' },
];
</script>

<template>
  <header class="admin-header">
    <div class="admin-topbar">
      <RouterLink
        aria-label="Inbox Point — открыть ответы"
        class="admin-brand"
        to="/manage"
      >
        <ProductLogo />
      </RouterLink>
      <nav class="admin-navigation" aria-label="Разделы администратора">
        <RouterLink
          v-for="section in sections"
          :key="section.id"
          :aria-current="current === section.id ? 'page' : undefined"
          :to="section.href"
        >
          {{ section.label }}
        </RouterLink>
      </nav>
      <button
        v-if="showLogout"
        class="quiet admin-logout"
        type="button"
        @click="$emit('logout')"
      >
        Выйти
      </button>
    </div>
    <div class="admin-page-heading">
      <h1>{{ title }}</h1>
      <p v-if="intro" class="page-intro">{{ intro }}</p>
    </div>
  </header>
</template>

<style scoped src="../styles/admin-page-header.css"></style>
