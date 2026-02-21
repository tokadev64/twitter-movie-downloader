<script setup lang="ts">
import type { MediaInfo } from "@tmd/shared";

const props = defineProps<{
  mediaList: MediaInfo[];
  tweetId: string;
}>();

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function formatQuality(quality: string): string {
  if (quality === "unknown") return "Unknown Quality";
  const bitrate = Number.parseInt(quality, 10);
  if (bitrate >= 1000000) return `${(bitrate / 1000000).toFixed(1)} Mbps`;
  if (bitrate >= 1000) return `${(bitrate / 1000).toFixed(0)} Kbps`;
  return `${quality} bps`;
}

function formatResolution(media: MediaInfo): string | undefined {
  if (media.width && media.height) return `${media.width}×${media.height}`;
  return undefined;
}

function formatAspectRatio(media: MediaInfo): string | undefined {
  if (media.aspectRatio) return `${media.aspectRatio[0]}:${media.aspectRatio[1]}`;
  return undefined;
}

function formatCodec(media: MediaInfo): string | undefined {
  const parts: string[] = [];
  if (media.videoCodec) parts.push(media.videoCodec);
  if (media.audioCodec) parts.push(media.audioCodec);
  return parts.length > 0 ? parts.join("/") : undefined;
}

function formatFileSize(bytes: number | undefined): string | undefined {
  if (bytes === undefined) return undefined;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDuration(ms: number | undefined): string | undefined {
  if (ms === undefined) return undefined;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function downloadUrl(media: MediaInfo): string {
  return `${API_BASE_URL}/api/tweet/${props.tweetId}/download?quality=${encodeURIComponent(media.quality)}`;
}

const thumbnail = props.mediaList[0]?.thumbnailUrl;
const duration = formatDuration(props.mediaList[0]?.durationMs);
</script>

<template>
  <div v-if="mediaList.length > 0" class="video-result-list">
    <h2>Found {{ mediaList.length }} video(s) for tweet {{ tweetId }}</h2>

    <div v-if="thumbnail" class="thumbnail-wrapper">
      <img :src="thumbnail" alt="Video thumbnail" class="thumbnail" />
      <span v-if="duration" class="duration-badge">{{ duration }}</span>
    </div>

    <ul class="media-list">
      <li v-for="(media, index) in mediaList" :key="index" class="media-item">
        <div class="media-meta">
          <span v-if="formatResolution(media)" class="meta-tag resolution">
            {{ formatResolution(media) }}
          </span>
          <span v-if="formatAspectRatio(media)" class="meta-tag aspect">
            {{ formatAspectRatio(media) }}
          </span>
          <span v-if="formatCodec(media)" class="meta-tag codec">
            {{ formatCodec(media) }}
          </span>
          <span v-if="formatFileSize(media.fileSizeBytes)" class="meta-tag size">
            {{ formatFileSize(media.fileSizeBytes) }}
          </span>
          <span v-if="!formatResolution(media)" class="meta-tag bitrate">
            {{ formatQuality(media.quality) }}
          </span>
        </div>
        <a :href="downloadUrl(media)" class="download-btn" aria-label="Download">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M3 15.5h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
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

.thumbnail-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
}

.thumbnail {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.duration-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.media-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.media-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.media-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-tag {
  font-size: 13px;
  color: #495057;
  white-space: nowrap;
}

.meta-tag.resolution {
  font-weight: 700;
  font-size: 14px;
  color: #212529;
}

.meta-tag.size {
  font-weight: 600;
  color: #0d6efd;
}

.meta-tag.bitrate {
  font-weight: 600;
  color: #495057;
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #28a745;
  color: white;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
  flex-shrink: 0;
}

.download-btn:hover {
  background: #218838;
}
</style>
