import { assertRejects } from "jsr:@std/assert";
import { fetchTweetMedia, resetGuestTokenCache } from "./twitter-client.ts";

Deno.test("fetchTweetMedia: throws without TWITTER_BEARER_TOKEN", async () => {
  resetGuestTokenCache();
  const original = Deno.env.get("TWITTER_BEARER_TOKEN");
  Deno.env.delete("TWITTER_BEARER_TOKEN");

  try {
    await assertRejects(
      () => fetchTweetMedia("123456789"),
      Error,
      "TWITTER_BEARER_TOKEN environment variable is required",
    );
  } finally {
    if (original) {
      Deno.env.set("TWITTER_BEARER_TOKEN", original);
    }
  }
});
