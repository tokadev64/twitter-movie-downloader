export interface VideoVariant {
  bitrate?: number;
  content_type: string;
  url: string;
}

export interface MediaInfo {
  videoUrl: string;
  quality: string;
}

export interface TweetInfoResponse {
  tweetId: string;
  mediaList: MediaInfo[];
}

export interface ApiErrorResponse {
  error: string;
  code: string;
}
