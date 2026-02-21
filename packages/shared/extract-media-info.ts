import type { MediaInfo, VideoVariant } from "./types.ts";

const CODEC_MAP: Record<string, string> = {
  avc1: "H.264",
  av01: "AV1",
};

interface VideoUrlMetadata {
  width: number;
  height: number;
  videoCodec?: string;
}

/**
 * Parse resolution and codec from Twitter video URL.
 * Patterns:
 *   /vid/avc1/1280x720/  → codec + resolution
 *   /vid/1280x720/       → resolution only
 */
export function parseVideoUrlMetadata(url: string): VideoUrlMetadata | undefined {
  // Pattern with codec: /vid/<codec>/<width>x<height>/
  const withCodec = url.match(/\/vid\/([a-z0-9]+)\/(\d+)x(\d+)\//);
  if (withCodec) {
    const [, rawCodec, w, h] = withCodec;
    return {
      width: Number(w),
      height: Number(h),
      videoCodec: CODEC_MAP[rawCodec] ?? rawCodec,
    };
  }

  // Pattern without codec: /vid/<width>x<height>/
  const withoutCodec = url.match(/\/vid\/(\d+)x(\d+)\//);
  if (withoutCodec) {
    const [, w, h] = withoutCodec;
    return { width: Number(w), height: Number(h) };
  }

  return undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: Twitter API response has complex dynamic structure
export function extractMediaInfo(tweetData: any): MediaInfo[] {
  if (!tweetData.data?.tweetResult?.result) {
    throw new Error("Tweet data not available");
  }

  const result = tweetData.data.tweetResult.result;

  if (result.__typename === "TweetTombstone") {
    throw new Error("Tweet is not available (deleted, protected, or restricted)");
  }

  // Standard tweets: result.legacy.entities.media
  // Visibility-restricted tweets: result.tweet.legacy.entities.media
  const media = result.legacy?.entities?.media || result.tweet?.legacy?.entities?.media;

  if (!media || !Array.isArray(media)) {
    throw new Error("No media found in tweet");
  }

  const mediaList: MediaInfo[] = [];

  for (const item of media) {
    if (item.type === "video" || item.type === "animated_gif") {
      const videoInfo = item.video_info;
      const rawThumbnail = item.media_url_https as string | undefined;
      const thumbnailUrl = rawThumbnail?.startsWith("https://") ? rawThumbnail : undefined;

      const aspectRatio: [number, number] | undefined =
        Array.isArray(videoInfo.aspect_ratio) && videoInfo.aspect_ratio.length === 2
          ? [videoInfo.aspect_ratio[0], videoInfo.aspect_ratio[1]]
          : undefined;
      const durationMs: number | undefined =
        typeof videoInfo.duration_millis === "number" ? videoInfo.duration_millis : undefined;

      const m3u8Variant = videoInfo.variants.find(
        (v: VideoVariant) => v.content_type === "application/x-mpegURL",
      );

      const mp4Variants = videoInfo.variants
        .filter((v: VideoVariant) => v.content_type === "video/mp4")
        .sort((a: VideoVariant, b: VideoVariant) => {
          const bitrateA = a.bitrate || 0;
          const bitrateB = b.bitrate || 0;
          return bitrateB - bitrateA;
        });

      if (m3u8Variant) {
        mediaList.push({
          videoUrl: m3u8Variant.url,
          quality: "HLS",
          thumbnailUrl,
          aspectRatio,
          durationMs,
        });
      }

      for (const variant of mp4Variants) {
        const urlMeta = parseVideoUrlMetadata(variant.url);
        mediaList.push({
          videoUrl: variant.url,
          quality: variant.bitrate ? `${variant.bitrate}` : "unknown",
          thumbnailUrl,
          aspectRatio,
          durationMs,
          audioCodec: "AAC",
          ...(urlMeta && {
            width: urlMeta.width,
            height: urlMeta.height,
            videoCodec: urlMeta.videoCodec,
          }),
        });
      }
    }
  }

  return mediaList;
}
