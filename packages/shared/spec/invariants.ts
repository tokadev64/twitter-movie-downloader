import { basename, extname } from "node:path";

import type { MediaInfo, VideoFormat, VideoVariant } from "../types.ts";

const TWEET_ID_PATTERN = /(?:mobile\.)?(?:twitter|x)\.com\/\w+\/status\/(\d+)/;

export function isDigitOnly(value: string): boolean {
  return /^\d+$/.test(value);
}

export function buildTweetUrl(domain: string, username: string, tweetId: string): string {
  return `https://${domain}/${username}/status/${tweetId}`;
}

/** 台帳 §4 の記述から書いた期待組み立て器。sanitizeOutputPath と同型であることが契約。 */
export function predictOutputPath(
  outputPath: string | undefined,
  tweetId: string,
  format: VideoFormat = "mp4",
): string {
  const fallback = `twitter_video_${tweetId}.${format}`;
  if (!outputPath) return fallback;
  const safe = basename(outputPath);
  if (!safe || safe === "/" || safe === "\\") return fallback;
  const ext = extname(safe);
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  return `${stem}.${format}`;
}

export interface PredictedMediaEntry {
  videoUrl: string;
  quality: string;
}

/** 台帳 §3 の記述から書いた期待順序組み立て器。 */
export function predictMediaOrder(variants: VideoVariant[]): PredictedMediaEntry[] {
  const entries: PredictedMediaEntry[] = [];
  const hls = variants.find((v) => v.content_type === "application/x-mpegURL");
  if (hls) entries.push({ videoUrl: hls.url, quality: "HLS" });
  const mp4 = variants
    .filter((v) => v.content_type === "video/mp4")
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  for (const variant of mp4) {
    entries.push({
      videoUrl: variant.url,
      quality: variant.bitrate ? `${variant.bitrate}` : "unknown",
    });
  }
  return entries;
}

/** CODEC_MAP の主張(avc1→H.264、av01→AV1、他素通し)。 */
export function expectCodecLabel(rawCodec: string): string {
  if (rawCodec === "avc1") return "H.264";
  if (rawCodec === "av01") return "AV1";
  return rawCodec;
}

export function mp4BitrateDescending(list: MediaInfo[]): boolean {
  const numeric = list
    .filter((m) => m.quality !== "HLS")
    .map((m) => (m.quality === "unknown" ? 0 : Number(m.quality)));
  for (let i = 1; i < numeric.length; i += 1) {
    if (numeric[i - 1] < numeric[i]) return false;
  }
  return true;
}

export function hlsAtMostOneFirst(list: MediaInfo[]): boolean {
  const hlsIndexes = list.map((m, i) => (m.quality === "HLS" ? i : -1)).filter((i) => i >= 0);
  if (hlsIndexes.length > 1) return false;
  if (hlsIndexes.length === 1) {
    const firstMp4 = list.findIndex((m) => m.quality !== "HLS");
    if (firstMp4 !== -1 && hlsIndexes[0] > firstMp4) return false;
  }
  return true;
}

export function allowedVideoHost(url: string): { parsed: boolean; allowed: boolean } {
  try {
    const { hostname } = new URL(url);
    return { parsed: true, allowed: ["video.twimg.com", "pbs.twimg.com"].includes(hostname) };
  } catch {
    return { parsed: false, allowed: false };
  }
}

export function hasTweetIdSubstring(value: string): boolean {
  return TWEET_ID_PATTERN.test(value);
}
