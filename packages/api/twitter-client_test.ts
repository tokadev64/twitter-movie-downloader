import { test } from "bun:test";
import assert from "node:assert/strict";

import { fetchTweetMedia, resetGuestTokenCache } from "./twitter-client.ts";

test("fetchTweetMedia: throws without TWITTER_BEARER_TOKEN", async () => {
  resetGuestTokenCache();
  const original = process.env.TWITTER_BEARER_TOKEN;
  delete process.env.TWITTER_BEARER_TOKEN;

  try {
    await assert.rejects(
      () => fetchTweetMedia("123456789"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("TWITTER_BEARER_TOKEN environment variable is required"),
    );
  } finally {
    if (original) {
      process.env.TWITTER_BEARER_TOKEN = original;
    }
  }
});
