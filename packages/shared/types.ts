export interface VideoVariant {
  bitrate?: number;
  content_type: string;
  url: string;
}

export interface MediaInfo {
  videoUrl: string;
  quality: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  aspectRatio?: [number, number];
  durationMs?: number;
  videoCodec?: string;
  audioCodec?: string;
  fileSizeBytes?: number;
}

export interface TweetInfoResponse {
  tweetId: string;
  mediaList: MediaInfo[];
}

export interface ApiErrorResponse {
  error: string;
  code: string;
}

export type VideoFormat = "mp4";
