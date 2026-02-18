<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{
  submit: [url: string];
}>();

defineProps<{
  isLoading: boolean;
}>();

const inputUrl = ref("");

function handleSubmit(): void {
  const url = inputUrl.value.trim();
  if (url) {
    emit("submit", url);
  }
}
</script>

<template>
  <form class="tweet-url-input" @submit.prevent="handleSubmit">
    <input
      v-model="inputUrl"
      type="text"
      placeholder="https://x.com/user/status/123456789"
      :disabled="isLoading"
      class="url-input"
    />
    <button type="submit" :disabled="isLoading || !inputUrl.trim()" class="submit-button">
      {{ isLoading ? "Loading..." : "Get Videos" }}
    </button>
  </form>
</template>

<style scoped>
.tweet-url-input {
  display: flex;
  gap: 8px;
  width: 100%;
}

.url-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.url-input:focus {
  border-color: #1da1f2;
}

.url-input:disabled {
  background: #f5f5f5;
}

.submit-button {
  padding: 12px 24px;
  background: #1da1f2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.submit-button:hover:not(:disabled) {
  background: #1a91da;
}

.submit-button:disabled {
  background: #aaa;
  cursor: not-allowed;
}
</style>
