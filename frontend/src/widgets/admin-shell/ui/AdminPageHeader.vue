<script setup lang="ts">
export type AdminSection = 'channels' | 'information' | 'status';

defineProps<{
  authenticated: boolean;
  current: AdminSection;
  intro: string;
  title: string;
}>();
defineEmits<{ logout: [] }>();

const sections: readonly {
  href: string;
  id: AdminSection;
  label: string;
}[] = [
  { href: '/manage', id: 'information', label: 'Информация' },
  { href: '/setup', id: 'channels', label: 'Каналы' },
  { href: '/ops', id: 'status', label: 'Состояние' },
];
</script>

<template>
  <header class="admin-header">
    <div class="admin-header-row">
      <div>
        <p class="eyebrow">Messenger Handoff</p>
        <h1>{{ title }}</h1>
        <p class="page-intro">{{ intro }}</p>
      </div>
      <button
        v-if="authenticated"
        class="secondary-button"
        type="button"
        @click="$emit('logout')"
      >
        Выйти
      </button>
    </div>

    <nav
      v-if="authenticated"
      class="admin-navigation"
      aria-label="Разделы администратора"
    >
      <a
        v-for="section in sections"
        :key="section.id"
        :aria-current="current === section.id ? 'page' : undefined"
        :href="section.href"
      >
        {{ section.label }}
      </a>
    </nav>
  </header>
</template>
