import type { ApiErrorResponse, TweetInfoResponse } from "@tmd/shared";
import { extractTweetId } from "@tmd/shared";
import type { Context } from "hono";
import { fetchTweetMedia } from "../twitter-client.ts";

export async function handleTweetInfo(c: Context): Promise<Response> {
  try {
    const tweetId = c.req.param("id");
    const validatedId = extractTweetId(tweetId);
    const allMedia = await fetchTweetMedia(validatedId);
    const mediaList = allMedia.filter((m) => m.quality !== "HLS");

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
