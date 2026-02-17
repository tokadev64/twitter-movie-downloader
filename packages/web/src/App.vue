<script setup lang="ts">
import ErrorMessage from "./components/ErrorMessage.vue";
import TweetUrlInput from "./components/TweetUrlInput.vue";
import VideoResultList from "./components/VideoResultList.vue";
import { useTweetDownload } from "./composables/useTweetDownload.ts";

const { mediaList, tweetId, isLoading, errorMessage, fetchTweetInfo } = useTweetDownload();
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>Twitter/X Video Downloader</h1>
      <p>Paste a tweet URL to get video download links</p>
    </header>

    <main class="app-main">
      <TweetUrlInput :is-loading="isLoading" @submit="fetchTweetInfo" />
      <ErrorMessage :message="errorMessage" />
      <VideoResultList :media-list="mediaList" :tweet-id="tweetId" />
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 640px;
  margin: 0 auto;
  padding: 40px 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.app-header {
  text-align: center;
  margin-bottom: 32px;
}

.app-header h1 {
  font-size: 28px;
  color: #1da1f2;
  margin-bottom: 8px;
}

.app-header p {
  color: #666;
  font-size: 16px;
}

.app-main {
  display: flex;
  flex-direction: column;
}
</style>
