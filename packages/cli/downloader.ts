import { rename, rm, writeFile } from "node:fs/promises";

import {
  buildGraphqlUrl,
  extractMediaInfo,
  extractTweetId,
  sanitizeOutputPath,
  validateVideoUrl,
} from "@tmd/shared";

// Twitter ウェブクライアントの公開 Bearer Token
// セキュリティ上、環境変数での上書きを推奨
export const DEFAULT_BEARER_TOKEN =
  "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

export class TwitterVideoDownloader {
  private guestToken?: string;
  private readonly bearerToken: string;

  constructor() {
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN ?? DEFAULT_BEARER_TOKEN;
  }

  private async getGuestToken(): Promise<string> {
    const response = await fetch("https://api.twitter.com/1.1/guest/activate.json", {
      method: "POST",
      headers: {
        Authorization: this.bearerToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get guest token: ${response.status}`);
    }

    const data = await response.json();
    return data.guest_token;
  }

  // oxlint-disable-next-line typescript/no-explicit-any -- Twitter API response has complex dynamic structure
  private async getTweetData(tweetId: string): Promise<any> {
    if (!this.guestToken) {
      this.guestToken = await this.getGuestToken();
    }

    const url = buildGraphqlUrl(tweetId);

    const response = await fetch(url, {
      headers: {
        Authorization: this.bearerToken,
        "x-guest-token": this.guestToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tweet data: ${response.status}`);
    }

    return await response.json();
  }

  private async runFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
    const proc = Bun.spawn(["ffmpeg", ...args], {
      stdout: "ignore",
      stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    return { code, stderr };
  }

  private logFfmpegErrors(stderr: string): void {
    for (const line of stderr.split("\n")) {
      if (line.includes("error") || line.includes("Error")) {
        console.error("FFmpeg error:", line);
      }
    }
  }

  private async downloadWithHLS(hlsUrl: string, outputPath: string): Promise<void> {
    validateVideoUrl(hlsUrl);
    console.log("Downloading HLS stream with FFmpeg...");

    const tempMp4 = `${outputPath}.temp.mp4`;
    const { code, stderr } = await this.runFfmpeg([
      "-i",
      hlsUrl,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      "-y",
      tempMp4,
    ]);
    this.logFfmpegErrors(stderr);

    if (code !== 0) {
      throw new Error("FFmpeg failed to download HLS stream");
    }

    await rename(tempMp4, outputPath);
    console.log(`Downloaded and converted to: ${outputPath}`);
  }

  private async downloadMP4(videoUrl: string, outputPath: string): Promise<void> {
    validateVideoUrl(videoUrl);
    console.log(`Downloading MP4 from: ${videoUrl}`);

    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status}`);
    }

    const data = await response.arrayBuffer();
    const tempFile = `${outputPath}.temp`;
    await writeFile(tempFile, new Uint8Array(data));

    console.log("Re-encoding video with FFmpeg...");

    const { code, stderr } = await this.runFfmpeg([
      "-i",
      tempFile,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-preset",
      "medium",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      "-y",
      outputPath,
    ]);
    this.logFfmpegErrors(stderr);

    if (code !== 0) {
      await rm(tempFile, { force: true });
      throw new Error("FFmpeg failed to re-encode video");
    }

    await rm(tempFile, { force: true });
    console.log(`Downloaded and re-encoded to: ${outputPath}`);
  }

  private async checkFFmpeg(): Promise<boolean> {
    try {
      const proc = Bun.spawn(["ffmpeg", "-version"], {
        stdout: "ignore",
        stderr: "ignore",
      });
      return (await proc.exited) === 0;
    } catch {
      return false;
    }
  }

  public async download(tweetUrl: string, outputPath?: string): Promise<void> {
    try {
      const hasFFmpeg = await this.checkFFmpeg();
      if (!hasFFmpeg) {
        console.error("Error: FFmpeg is not installed. Please install FFmpeg first.");
        console.error("Ubuntu/Debian: sudo apt-get install ffmpeg");
        console.error("macOS: brew install ffmpeg");
        console.error("Windows: Download from https://ffmpeg.org/download.html");
        process.exit(1);
      }

      console.log("Extracting tweet ID...");
      const tweetId = extractTweetId(tweetUrl);

      console.log("Fetching tweet data...");
      const tweetData = await this.getTweetData(tweetId);

      console.log("Extracting media info...");
      const mediaList = extractMediaInfo(tweetData);

      if (mediaList.length === 0) {
        throw new Error("No videos found in the tweet");
      }

      console.log(`Found ${mediaList.length} media options:`);
      for (const [index, media] of mediaList.entries()) {
        console.log(`  ${index + 1}. Quality: ${media.quality}`);
      }

      const filename = sanitizeOutputPath(outputPath, tweetId);

      const hlsMedia = mediaList.find((m) => m.quality === "HLS");
      if (hlsMedia) {
        await this.downloadWithHLS(hlsMedia.videoUrl, filename);
      } else {
        const selectedMedia = mediaList[0];
        await this.downloadMP4(selectedMedia.videoUrl, filename);
      }

      console.log("Download completed successfully!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  }
}
