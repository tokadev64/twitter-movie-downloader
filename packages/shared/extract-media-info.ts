import type { MediaInfo, VideoVariant } from "./types.ts";

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
        });
      }

      for (const variant of mp4Variants) {
        mediaList.push({
          videoUrl: variant.url,
          quality: variant.bitrate ? `${variant.bitrate}` : "unknown",
        });
      }
    }
  }

  return mediaList;
}
