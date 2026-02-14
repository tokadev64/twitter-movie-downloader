#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read --allow-run

interface VideoVariant {
  bitrate?: number;
  content_type: string;
  url: string;
}

interface MediaInfo {
  videoUrl: string;
  audioUrl?: string;
  quality: string;
}

class TwitterVideoDownloader {
  private guestToken?: string;
  private bearerToken =
    "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

  private extractTweetId(url: string): string {
    const patterns = [
      /twitter\.com\/\w+\/status\/(\d+)/,
      /x\.com\/\w+\/status\/(\d+)/,
      /t\.co\/(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    throw new Error("Invalid Twitter/X URL");
  }

  private async getGuestToken(): Promise<string> {
    const response = await fetch("https://api.twitter.com/1.1/guest/activate.json", {
      method: "POST",
      headers: {
        Authorization: this.bearerToken,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get guest token");
    }

    const data = await response.json();
    return data.guest_token;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Twitter API response has complex dynamic structure
  private async getTweetData(tweetId: string): Promise<any> {
    if (!this.guestToken) {
      this.guestToken = await this.getGuestToken();
    }

    const url = `https://api.twitter.com/graphql/2ICDjqPd81tulZcYrtpTuQ/TweetResultByRestId?variables=%7B%22tweetId%22%3A%22${tweetId}%22%2C%22withCommunity%22%3Afalse%2C%22includePromotedContent%22%3Afalse%2C%22withVoice%22%3Afalse%7D&features=%7B%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D`;

    const response = await fetch(url, {
      headers: {
        Authorization: this.bearerToken,
        "x-guest-token": this.guestToken,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch tweet data");
    }

    return await response.json();
  }

  // biome-ignore lint/suspicious/noExplicitAny: Twitter API response has complex dynamic structure
  private extractMediaInfo(tweetData: any): MediaInfo[] {
    const mediaList: MediaInfo[] = [];


    try {
      // Check if tweet exists and is accessible
      if (!tweetData.data?.tweetResult?.result) {
        throw new Error("Tweet data not available");
      }

      const result = tweetData.data.tweetResult.result;
      
      // Handle different response types
      if (result.__typename === "TweetTombstone") {
        throw new Error("Tweet is not available (deleted, protected, or restricted)");
      }
      
      if (result.__typename === "TweetWithVisibilityResults") {
        // Handle tweets with visibility restrictions
        if (result.tweet?.legacy?.entities?.media) {
          const media = result.tweet.legacy.entities.media;
        } else {
          throw new Error("No media found in restricted tweet");
        }
      }

      // Try different paths where media might be located
      const media = result.legacy?.entities?.media || 
                   result.tweet?.legacy?.entities?.media ||
                   result.core?.user_results?.result?.legacy?.entities?.media;

      if (!media || !Array.isArray(media)) {
        throw new Error("No media found in tweet");
      }

      for (const item of media) {
        if (item.type === "video" || item.type === "animated_gif") {
          const videoInfo = item.video_info;

          // m3u8形式（HLSストリーム）を探す
          const m3u8Variant = videoInfo.variants.find(
            (v: VideoVariant) => v.content_type === "application/x-mpegURL",
          );

          // MP4形式の動画を取得
          const mp4Variants = videoInfo.variants
            .filter((v: VideoVariant) => v.content_type === "video/mp4")
            .sort((a: VideoVariant, b: VideoVariant) => {
              const bitrateA = a.bitrate || 0;
              const bitrateB = b.bitrate || 0;
              return bitrateB - bitrateA;
            });

          if (m3u8Variant) {
            // HLSストリームがある場合は、音声付きの可能性が高い
            mediaList.push({
              videoUrl: m3u8Variant.url,
              quality: "HLS",
            });
          }

          // MP4バリアントも追加
          for (const variant of mp4Variants) {
            mediaList.push({
              videoUrl: variant.url,
              quality: variant.bitrate ? `${variant.bitrate}` : "unknown",
            });
          }
        }
      }
    } catch (_error) {
      throw new Error("No video found in the tweet");
    }

    return mediaList;
  }

  private async downloadWithHLS(hlsUrl: string, outputPath: string): Promise<void> {
    console.log("Downloading HLS stream with FFmpeg...");

    const tempMp4 = `${outputPath}.temp.mp4`;

    // FFmpegでHLSストリームをダウンロードし、適切にエンコード
    const ffmpegCommand = new Deno.Command("ffmpeg", {
      args: [
        "-i",
        hlsUrl,
        "-c:v",
        "libx264", // H.264ビデオコーデック
        "-c:a",
        "aac", // AAC音声コーデック
        "-preset",
        "medium", // エンコード速度と品質のバランス
        "-crf",
        "23", // 品質設定（0-51、低いほど高品質）
        "-movflags",
        "+faststart", // Web再生用の最適化
        "-pix_fmt",
        "yuv420p", // 互換性のあるピクセルフォーマット
        "-y", // 上書き確認なし
        tempMp4,
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const process = ffmpegCommand.spawn();

    // エラー出力を監視
    const decoder = new TextDecoder();
    for await (const chunk of process.stderr) {
      const text = decoder.decode(chunk);
      if (text.includes("error") || text.includes("Error")) {
        console.error("FFmpeg error:", text);
      }
    }

    const { success } = await process.status;

    if (!success) {
      throw new Error("FFmpeg failed to download HLS stream");
    }

    // 一時ファイルを最終ファイルに移動
    await Deno.rename(tempMp4, outputPath);
    console.log(`Downloaded and converted to: ${outputPath}`);
  }

  private async downloadMP4(videoUrl: string, outputPath: string): Promise<void> {
    console.log(`Downloading MP4 from: ${videoUrl}`);

    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error("Failed to download video");
    }

    const data = await response.arrayBuffer();
    const tempFile = `${outputPath}.temp`;
    await Deno.writeFile(tempFile, new Uint8Array(data));

    // FFmpegで再エンコード（音声トラックの修正と最初のフレームの問題を解決）
    console.log("Re-encoding video with FFmpeg...");

    const ffmpegCommand = new Deno.Command("ffmpeg", {
      args: [
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
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const process = ffmpegCommand.spawn();
    await process.status;

    // 一時ファイルを削除
    await Deno.remove(tempFile);

    console.log(`Downloaded and re-encoded to: ${outputPath}`);
  }

  private async checkFFmpeg(): Promise<boolean> {
    try {
      const command = new Deno.Command("ffmpeg", {
        args: ["-version"],
        stdout: "piped",
        stderr: "piped",
      });

      const { success } = await command.output();
      return success;
    } catch {
      return false;
    }
  }

  public async download(tweetUrl: string, outputPath?: string): Promise<void> {
    try {
      // FFmpegの存在確認
      const hasFFmpeg = await this.checkFFmpeg();
      if (!hasFFmpeg) {
        console.error("Error: FFmpeg is not installed. Please install FFmpeg first.");
        console.error("Ubuntu/Debian: sudo apt-get install ffmpeg");
        console.error("macOS: brew install ffmpeg");
        console.error("Windows: Download from https://ffmpeg.org/download.html");
        Deno.exit(1);
      }

      console.log("Extracting tweet ID...");
      const tweetId = this.extractTweetId(tweetUrl);

      console.log("Fetching tweet data...");
      const tweetData = await this.getTweetData(tweetId);

      console.log("Extracting media info...");
      const mediaList = this.extractMediaInfo(tweetData);

      if (mediaList.length === 0) {
        throw new Error("No videos found in the tweet");
      }

      console.log(`Found ${mediaList.length} media options:`);
      mediaList.forEach((media, index) => {
        console.log(`  ${index + 1}. Quality: ${media.quality}`);
      });

      const filename = outputPath || `twitter_video_${tweetId}.mp4`;

      // HLSストリームを優先（音声付きの可能性が高い）
      const hlsMedia = mediaList.find((m) => m.quality === "HLS");
      if (hlsMedia) {
        await this.downloadWithHLS(hlsMedia.videoUrl, filename);
      } else {
        // HLSがない場合は最高品質のMP4をダウンロード
        const selectedMedia = mediaList[0];
        await this.downloadMP4(selectedMedia.videoUrl, filename);
      }

      console.log("Download completed successfully!");
    } catch (error) {
      console.error("Error:", error.message);
      Deno.exit(1);
    }
  }
}

// CLI実行
if (import.meta.main) {
  const args = Deno.args;

  if (args.length < 1) {
    console.log(
      "Usage: deno run --allow-net --allow-write --allow-read --allow-run twitter-video-downloader.ts <tweet-url> [output-file]",
    );
    console.log(
      "Example: deno run --allow-net --allow-write --allow-read --allow-run twitter-video-downloader.ts https://twitter.com/user/status/123456789 video.mp4",
    );
    Deno.exit(1);
  }

  const tweetUrl = args[0];
  const outputFile = args[1];

  const downloader = new TwitterVideoDownloader();
  await downloader.download(tweetUrl, outputFile);
}
