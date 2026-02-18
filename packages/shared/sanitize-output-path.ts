import { basename } from "jsr:@std/path";

export function sanitizeOutputPath(outputPath: string | undefined, tweetId: string): string {
  if (!outputPath) {
    return `twitter_video_${tweetId}.mp4`;
  }
  return basename(outputPath);
}
