import { extname } from "node:path";

import type { VideoFormat, VideoVariant } from "../types.ts";

export function brokenExtractNoTrim(url: string): string {
  if (/^\d+$/.test(url)) {
    return url;
  }
  const pattern = /(?:mobile\.)?(?:twitter|x)\.com\/\w+\/status\/(\d+)/;
  const match = url.match(pattern);
  if (match) return match[1];
  throw new Error("Invalid Twitter/X URL");
}

export function brokenSanitizeNoBasename(
  outputPath: string | undefined,
  tweetId: string,
  format: VideoFormat = "mp4",
): string {
  if (!outputPath) {
    return `twitter_video_${tweetId}.${format}`;
  }
  const safe = outputPath;
  if (!safe) {
    return `twitter_video_${tweetId}.${format}`;
  }
  const ext = extname(safe);
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  return `${stem}.${format}`;
}

export function brokenMediaSortAscending(
  variants: VideoVariant[],
): { videoUrl: string; quality: string }[] {
  const entries: { videoUrl: string; quality: string }[] = [];
  const hls = variants.find((v) => v.content_type === "application/x-mpegURL");
  if (hls) entries.push({ videoUrl: hls.url, quality: "HLS" });
  const mp4 = variants
    .filter((v) => v.content_type === "video/mp4")
    .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
  for (const variant of mp4) {
    entries.push({
      videoUrl: variant.url,
      quality: variant.bitrate ? `${variant.bitrate}` : "unknown",
    });
  }
  return entries;
}

export function brokenCodecMapSwapped(
  url: string,
): { width: number; height: number; videoCodec?: string } | undefined {
  const withCodec = url.match(/\/vid\/([a-z0-9]+)\/(\d+)x(\d+)\//);
  if (withCodec) {
    const [, rawCodec, w, h] = withCodec;
    const swapped = rawCodec === "avc1" ? "AV1" : rawCodec === "av01" ? "H.264" : rawCodec;
    return { width: Number(w), height: Number(h), videoCodec: swapped };
  }
  const withoutCodec = url.match(/\/vid\/(\d+)x(\d+)\//);
  if (withoutCodec) {
    const [, w, h] = withoutCodec;
    return { width: Number(w), height: Number(h) };
  }
  return undefined;
}

export function brokenHostSubstringMatch(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ["video.twimg.com", "pbs.twimg.com"].some((host) => hostname.includes(host));
  } catch {
    return false;
  }
}

export function brokenHostErrorFailsOpen(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ["video.twimg.com", "pbs.twimg.com"].includes(hostname);
  } catch {
    return true;
  }
}
