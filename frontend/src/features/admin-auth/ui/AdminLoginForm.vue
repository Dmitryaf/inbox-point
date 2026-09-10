<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ pending: boolean }>();
const emit = defineEmits<{ submit: [password: string] }>();
const password = ref('');

function submit(): void {
  if (!password.value || props.pending) {
    return;
  }
  emit('submit', password.value);
  password.value = '';
}
</script>

<template>
  <form class="auth-card card" @submit.prevent="submit">
    <h1>Вход в управление</h1>
    <p>Введите пароль администратора.</p>
    <label for="admin-password">Пароль</label>
    <input
      id="admin-password"
      v-model="password"
      autocomplete="current-password"
      required
      type="password"
    />
    <button :disabled="pending" type="submit">
      {{ pending ? 'Проверяем…' : 'Войти' }}
    </button>
  </form>
</template>

<style scoped src="../styles/admin-login-form.css"></style>
