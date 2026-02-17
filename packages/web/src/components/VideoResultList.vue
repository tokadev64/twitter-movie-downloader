<script setup lang="ts">
import type { MediaInfo } from "@tmd/shared";

defineProps<{
  mediaList: MediaInfo[];
  tweetId: string;
}>();

function formatQuality(quality: string): string {
  if (quality === "HLS") return "HLS (Highest Quality)";
  if (quality === "unknown") return "Unknown Quality";
  const bitrate = Number.parseInt(quality, 10);
  if (bitrate >= 1000000) return `${(bitrate / 1000000).toFixed(1)} Mbps`;
  if (bitrate >= 1000) return `${(bitrate / 1000).toFixed(0)} Kbps`;
  return `${quality} bps`;
}
</script>

<template>
  <div v-if="mediaList.length > 0" class="video-result-list">
    <h2>Found {{ mediaList.length }} video(s) for tweet {{ tweetId }}</h2>
    <ul class="media-list">
      <li v-for="(media, index) in mediaList" :key="index" class="media-item">
        <span class="quality-badge">{{ formatQuality(media.quality) }}</span>
        <a :href="media.videoUrl" target="_blank" rel="noopener noreferrer" class="download-link">
          Download
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.video-result-list {
  margin-top: 24px;
}

.video-result-list h2 {
  font-size: 18px;
  margin-bottom: 16px;
  color: #333;
}

.media-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.media-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.quality-badge {
  font-weight: 600;
  color: #495057;
}

.download-link {
  padding: 8px 16px;
  background: #28a745;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: bold;
  transition: background 0.2s;
}

.download-link:hover {
  background: #218838;
}
</style>
