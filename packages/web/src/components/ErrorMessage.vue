<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <div v-if="message" class="error-message">
    {{ message }}
  </div>
</template>

<style scoped>
.error-message {
  margin-top: 16px;
  padding: 12px 16px;
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffc107;
  border-radius: 8px;
  font-weight: 500;
}
</style>
