import { basename, extname } from "jsr:@std/path";
import type { VideoFormat } from "./types.ts";

export function sanitizeOutputPath(
  outputPath: string | undefined,
  tweetId: string,
  format: VideoFormat = "mp4",
): string {
  if (!outputPath) {
    return `twitter_video_${tweetId}.${format}`;
  }
  const safe = basename(outputPath);
  const ext = extname(safe);
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  return `${stem}.${format}`;
}
