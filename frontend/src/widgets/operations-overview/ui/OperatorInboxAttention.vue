<script setup lang="ts">
defineProps<{ recoverableRequests: number }>();
</script>

<template>
  <article class="operator-inbox-attention">
    <h3>Обращения ждут доставки в Telegram</h3>
    <p>
      Сохранено обращений: {{ recoverableRequests }}. Система повторит доставку
      автоматически.
    </p>
    <p>Пока проверьте входящие обращения ниже.</p>
  </article>
</template>

<style scoped src="../styles/operator-inbox-attention.css"></style>
