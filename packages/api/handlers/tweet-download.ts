import type { ApiErrorResponse } from "@tmd/shared";
import { extractTweetId } from "@tmd/shared";
import type { Context } from "hono";
import { fetchTweetMedia } from "../twitter-client.ts";

async function streamMp4Proxy(videoUrl: string): Promise<Response> {
  const upstream = await fetch(videoUrl);
  if (!upstream.ok) {
    throw new Error(`Failed to fetch video: ${upstream.status}`);
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "video/mp4",
    },
  });
}

export async function handleTweetDownload(c: Context): Promise<Response> {
  try {
    const tweetId = c.req.param("id");
    const quality = c.req.query("quality");

    if (!quality) {
      const body: { data: null; error: ApiErrorResponse } = {
        data: null,
        error: { error: "quality parameter is required", code: "INVALID_REQUEST" },
      };
      return c.json(body, 400);
    }

    const validatedId = extractTweetId(tweetId);
    const mediaList = await fetchTweetMedia(validatedId);

    const mp4Media = mediaList.filter((m) => m.quality !== "HLS");
    const media = mp4Media.find((m) => m.quality === quality);
    if (!media) {
      const body: { data: null; error: ApiErrorResponse } = {
        data: null,
        error: { error: `No video found with quality: ${quality}`, code: "NOT_FOUND" },
      };
      return c.json(body, 404);
    }

    const filename = `twitter_video_${validatedId}.mp4`;
    const response = await streamMp4Proxy(media.videoUrl);

    response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    return response;
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
