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
      media_url_https: "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
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
  assertEquals(
    result[0].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
  );
  assertEquals(result[1].quality, "2176000");
  assertEquals(result[1].videoUrl, "https://video.twimg.com/high.mp4");
  assertEquals(
    result[1].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
  );
  assertEquals(result[2].quality, "832000");
  assertEquals(
    result[2].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
  );
});

Deno.test("extractMediaInfo: animated_gif", () => {
  const tweetData = makeTweetData([
    {
      type: "animated_gif",
      media_url_https: "https://pbs.twimg.com/tweet_video_thumb/gif_thumb.jpg",
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
  assertEquals(result[0].thumbnailUrl, "https://pbs.twimg.com/tweet_video_thumb/gif_thumb.jpg");
});

Deno.test("extractMediaInfo: TweetWithVisibilityResults", () => {
  const tweetData = makeTweetData(
    [
      {
        type: "video",
        media_url_https: "https://pbs.twimg.com/ext_tw_video_thumb/456/pu/img/restricted_thumb.jpg",
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
  assertEquals(
    result[0].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/456/pu/img/restricted_thumb.jpg",
  );
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
      media_url_https: "https://pbs.twimg.com/ext_tw_video_thumb/789/pu/img/sort_thumb.jpg",
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
  assertEquals(
    result[0].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/789/pu/img/sort_thumb.jpg",
  );
  assertEquals(result[1].quality, "832000");
  assertEquals(result[2].quality, "256000");
});

Deno.test("extractMediaInfo: missing media_url_https returns undefined thumbnailUrl", () => {
  const tweetData = makeTweetData([
    {
      type: "video",
      video_info: {
        variants: [
          {
            content_type: "video/mp4",
            bitrate: 1000000,
            url: "https://video.twimg.com/no_thumb.mp4",
          },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);
  assertEquals(result.length, 1);
  assertEquals(result[0].thumbnailUrl, undefined);
});

Deno.test("extractMediaInfo: non-HTTPS media_url_https is filtered out", () => {
  const tweetData = makeTweetData([
    {
      type: "video",
      media_url_https: "http://pbs.twimg.com/insecure.jpg",
      video_info: {
        variants: [
          { content_type: "video/mp4", bitrate: 1000000, url: "https://video.twimg.com/test.mp4" },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);
  assertEquals(result.length, 1);
  assertEquals(result[0].thumbnailUrl, undefined);
});
