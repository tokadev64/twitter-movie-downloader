import { assertEquals, assertThrows } from "jsr:@std/assert";
import { extractMediaInfo } from "./extract-media-info.ts";

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
