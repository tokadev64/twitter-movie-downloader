import { assertEquals, assertThrows } from "jsr:@std/assert";
import {
  extractMediaInfo,
  extractTweetId,
  sanitizeOutputPath,
} from "./twitter-movie-downloader.ts";

// --- extractTweetId ---

Deno.test("extractTweetId: twitter.com URL", () => {
  assertEquals(extractTweetId("https://twitter.com/user/status/123456789"), "123456789");
});

Deno.test("extractTweetId: x.com URL", () => {
  assertEquals(extractTweetId("https://x.com/user/status/987654321"), "987654321");
});

Deno.test("extractTweetId: mobile.twitter.com URL", () => {
  assertEquals(extractTweetId("https://mobile.twitter.com/user/status/111222333"), "111222333");
});

Deno.test("extractTweetId: URL with query parameters", () => {
  assertEquals(extractTweetId("https://x.com/user/status/123456789?s=20&t=abc"), "123456789");
});

Deno.test("extractTweetId: direct tweet ID", () => {
  assertEquals(extractTweetId("123456789"), "123456789");
});

Deno.test("extractTweetId: direct tweet ID with whitespace", () => {
  assertEquals(extractTweetId("  123456789  "), "123456789");
});

Deno.test("extractTweetId: throws on invalid URL", () => {
  assertThrows(() => extractTweetId("https://example.com/invalid"), Error, "Invalid Twitter/X URL");
});

Deno.test("extractTweetId: throws on empty string", () => {
  assertThrows(() => extractTweetId(""), Error, "Invalid Twitter/X URL");
});

Deno.test("extractTweetId: throws on t.co short URL (not supported)", () => {
  assertThrows(() => extractTweetId("https://t.co/abc123"), Error, "Invalid Twitter/X URL");
});

// --- extractMediaInfo ---

function makeTweetData(
  media: unknown[],
  typename = "Tweet",
  nested = false,
): Record<string, unknown> {
  const legacy = { entities: { media } };
  const result = nested
    ? { __typename: typename, tweet: { legacy } }
    : { __typename: typename, legacy };
  return { data: { tweetResult: { result } } };
}

Deno.test("extractMediaInfo: standard tweet with video", () => {
  const tweetData = makeTweetData([
    {
      type: "video",
      video_info: {
        variants: [
          { content_type: "video/mp4", bitrate: 2176000, url: "https://video.twimg.com/high.mp4" },
          { content_type: "video/mp4", bitrate: 832000, url: "https://video.twimg.com/medium.mp4" },
          {
            content_type: "application/x-mpegURL",
            url: "https://video.twimg.com/playlist.m3u8",
          },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);

  assertEquals(result.length, 3);
  assertEquals(result[0].quality, "HLS");
  assertEquals(result[1].quality, "2176000");
  assertEquals(result[1].videoUrl, "https://video.twimg.com/high.mp4");
  assertEquals(result[2].quality, "832000");
});

Deno.test("extractMediaInfo: animated_gif", () => {
  const tweetData = makeTweetData([
    {
      type: "animated_gif",
      video_info: {
        variants: [
          { content_type: "video/mp4", bitrate: 0, url: "https://video.twimg.com/gif.mp4" },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);
  assertEquals(result.length, 1);
  assertEquals(result[0].videoUrl, "https://video.twimg.com/gif.mp4");
});

Deno.test("extractMediaInfo: TweetWithVisibilityResults", () => {
  const tweetData = makeTweetData(
    [
      {
        type: "video",
        video_info: {
          variants: [
            {
              content_type: "video/mp4",
              bitrate: 1000000,
              url: "https://video.twimg.com/restricted.mp4",
            },
          ],
        },
      },
    ],
    "TweetWithVisibilityResults",
    true,
  );

  const result = extractMediaInfo(tweetData);
  assertEquals(result.length, 1);
  assertEquals(result[0].videoUrl, "https://video.twimg.com/restricted.mp4");
});

Deno.test("extractMediaInfo: TweetTombstone throws", () => {
  const tweetData = {
    data: { tweetResult: { result: { __typename: "TweetTombstone" } } },
  };
  assertThrows(() => extractMediaInfo(tweetData), Error, "Tweet is not available");
});

Deno.test("extractMediaInfo: no media throws", () => {
  const tweetData = {
    data: { tweetResult: { result: { __typename: "Tweet", legacy: { entities: {} } } } },
  };
  assertThrows(() => extractMediaInfo(tweetData), Error, "No media found in tweet");
});

Deno.test("extractMediaInfo: empty data throws", () => {
  assertThrows(() => extractMediaInfo({}), Error, "Tweet data not available");
});

Deno.test("extractMediaInfo: photo-only tweet returns empty", () => {
  const tweetData = makeTweetData([{ type: "photo" }]);
  const result = extractMediaInfo(tweetData);
  assertEquals(result.length, 0);
});

Deno.test("extractMediaInfo: MP4 sorted by bitrate descending", () => {
  const tweetData = makeTweetData([
    {
      type: "video",
      video_info: {
        variants: [
          { content_type: "video/mp4", bitrate: 256000, url: "https://video.twimg.com/low.mp4" },
          { content_type: "video/mp4", bitrate: 2176000, url: "https://video.twimg.com/high.mp4" },
          {
            content_type: "video/mp4",
            bitrate: 832000,
            url: "https://video.twimg.com/medium.mp4",
          },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);
  assertEquals(result[0].quality, "2176000");
  assertEquals(result[1].quality, "832000");
  assertEquals(result[2].quality, "256000");
});

// --- sanitizeOutputPath ---

Deno.test("sanitizeOutputPath: default filename when undefined", () => {
  assertEquals(sanitizeOutputPath(undefined, "123456"), "twitter_video_123456.mp4");
});

Deno.test("sanitizeOutputPath: preserves simple filename", () => {
  assertEquals(sanitizeOutputPath("my_video.mp4", "123456"), "my_video.mp4");
});

Deno.test("sanitizeOutputPath: prevents path traversal with ../", () => {
  assertEquals(sanitizeOutputPath("../../etc/passwd", "123456"), "passwd");
});

Deno.test("sanitizeOutputPath: prevents absolute path", () => {
  assertEquals(sanitizeOutputPath("/tmp/evil.mp4", "123456"), "evil.mp4");
});

Deno.test("sanitizeOutputPath: handles nested path traversal", () => {
  assertEquals(sanitizeOutputPath("../../../tmp/malicious.mp4", "123456"), "malicious.mp4");
});
