<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ pending: boolean }>();
const emit = defineEmits<{
  submit: [password: string, rememberDevice: boolean];
}>();
const password = ref('');
const rememberDevice = ref(false);

function submit(): void {
  if (!password.value || props.pending) {
    return;
  }
  emit('submit', password.value, rememberDevice.value);
  password.value = '';
}
</script>

<template>
  <form class="auth-card" @submit.prevent="submit">
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
    <label class="remember-device">
      <input v-model="rememberDevice" type="checkbox" />
      <span>Запомнить это устройство на 30 дней</span>
    </label>
    <button :disabled="pending" type="submit">
      {{ pending ? 'Проверяем…' : 'Войти' }}
    </button>
  </form>
</template>

<style scoped src="../styles/admin-login-form.css"></style>
