<script setup lang="ts">
import type { MediaInfo, VideoFormat } from "@tmd/shared";
import { reactive } from "vue";

const props = defineProps<{
  mediaList: MediaInfo[];
  tweetId: string;
}>();

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const formats: Record<number, VideoFormat> = reactive({});

function getFormat(index: number): VideoFormat {
  return formats[index] ?? "mp4";
}

function setFormat(index: number, value: string): void {
  formats[index] = value as VideoFormat;
}

function formatQuality(quality: string): string {
  if (quality === "HLS") return "HLS (Highest Quality)";
  if (quality === "unknown") return "Unknown Quality";
  const bitrate = Number.parseInt(quality, 10);
  if (bitrate >= 1000000) return `${(bitrate / 1000000).toFixed(1)} Mbps`;
  if (bitrate >= 1000) return `${(bitrate / 1000).toFixed(0)} Kbps`;
  return `${quality} bps`;
}

function downloadUrl(media: MediaInfo, index: number): string {
  const format = getFormat(index);
  return `${API_BASE_URL}/api/tweet/${props.tweetId}/download?quality=${encodeURIComponent(media.quality)}&format=${format}`;
}
</script>

<template>
  <div v-if="mediaList.length > 0" class="video-result-list">
    <h2>Found {{ mediaList.length }} video(s) for tweet {{ tweetId }}</h2>
    <ul class="media-list">
      <li v-for="(media, index) in mediaList" :key="index" class="media-item">
        <span class="quality-badge">{{ formatQuality(media.quality) }}</span>
        <div class="download-controls">
          <select
            class="format-select"
            :value="getFormat(index)"
            @change="setFormat(index, ($event.target as HTMLSelectElement).value)"
          >
            <option value="mp4">MP4</option>
            <option value="mov">MOV</option>
          </select>
          <a :href="downloadUrl(media, index)" class="download-link">
            Download
          </a>
        </div>
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

.download-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.format-select {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  cursor: pointer;
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
