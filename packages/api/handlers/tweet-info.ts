import type { ApiErrorResponse, MediaInfo, TweetInfoResponse } from "@tmd/shared";
import { extractTweetId, isAllowedVideoHost } from "@tmd/shared";
import type { Context } from "hono";
import { fetchTweetMedia } from "../twitter-client.ts";

const HEAD_TIMEOUT_MS = 3000;

async function enrichWithFileSize(mediaList: MediaInfo[]): Promise<MediaInfo[]> {
  const results = await Promise.allSettled(
    mediaList.map(async (media) => {
      if (!isAllowedVideoHost(media.videoUrl)) return media;

      const res = await fetch(media.videoUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      });
      const contentLength = res.headers.get("content-length");
      const size = contentLength ? Number(contentLength) : Number.NaN;
      return Number.isFinite(size) ? { ...media, fileSizeBytes: size } : media;
    }),
  );

  return results.map((r, i) => (r.status === "fulfilled" ? r.value : mediaList[i]));
}

export async function handleTweetInfo(c: Context): Promise<Response> {
  try {
    const tweetId = c.req.param("id");
    const validatedId = extractTweetId(tweetId);
    const allMedia = await fetchTweetMedia(validatedId);
    const mp4Media = allMedia.filter((m) => m.quality !== "HLS");
    const mediaList = await enrichWithFileSize(mp4Media);

    const body: TweetInfoResponse = {
      tweetId: validatedId,
      mediaList,
    };

    return c.json({ data: body, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    const status = message.includes("Invalid") ? 400 : 502;
    const code = status === 400 ? "INVALID_REQUEST" : "UPSTREAM_ERROR";

    const body: { data: null; error: ApiErrorResponse } = {
      data: null,
      error: { error: message, code },
    };

    return c.json(body, status);
  }
}
