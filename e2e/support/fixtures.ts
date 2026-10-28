import type { VideoVariant } from "../../packages/shared/types.ts";

export function makeVideoVariant(url: string, contentType: string, bitrate?: number): VideoVariant {
  const variant: VideoVariant = { content_type: contentType, url };
  if (bitrate !== undefined) {
    variant.bitrate = bitrate;
  }
  return variant;
}

export interface VideoItemOptions {
  aspectRatio?: [number, number];
  durationMs?: number;
  mediaUrl?: string;
}

export function makeVideoItem(variants: VideoVariant[], options: VideoItemOptions = {}): unknown {
  const videoInfo: Record<string, unknown> = { variants };
  if (options.aspectRatio) {
    videoInfo.aspect_ratio = options.aspectRatio;
  }
  if (options.durationMs !== undefined) {
    videoInfo.duration_millis = options.durationMs;
  }

  const item: Record<string, unknown> = {
    type: "video",
    video_info: videoInfo,
  };
  if (options.mediaUrl) {
    item.media_url_https = options.mediaUrl;
  }
  return item;
}

export function makeTweetData(media: unknown[]): unknown {
  return {
    data: {
      tweetResult: {
        result: {
          __typename: "Tweet",
          legacy: {
            entities: {
              media,
            },
          },
        },
      },
    },
  };
}

export function makeTweetDataWithVariants(variants: VideoVariant[]): unknown {
  return makeTweetData([
    makeVideoItem(variants, {
      aspectRatio: [16, 9],
      durationMs: 60000,
      mediaUrl: "https://pbs.twimg.com/ext_tw_video_thumb/123/pri/img/thumb.jpg",
    }),
  ]);
}

export const TWEET_ID = "123456789";
export const HLS_URL = "https://video.twimg.com/hls/123456789/vid/avc1/1920x1080/hls.m3u8";
export const HIGH_MP4_URL =
  "https://video.twimg.com/ext_tw_video/123456789/vid/avc1/1920x1080/high.mp4";
export const LOW_MP4_URL = "https://pbs.twimg.com/ext_tw_video/123456789/vid/avc1/1280x720/low.mp4";
export const UNKNOWN_MP4_URL = "https://evil.example/unknown.mp4";
export const EXTERNAL_HIGH_MP4_URL = "https://evil.example/vid/avc1/1920x1080/high.mp4";
