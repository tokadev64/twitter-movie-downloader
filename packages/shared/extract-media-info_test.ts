import { assertEquals, assertThrows } from "jsr:@std/assert";
import { extractMediaInfo, parseVideoUrlMetadata } from "./extract-media-info.ts";

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

// ─── parseVideoUrlMetadata tests ──────────────────────────────

Deno.test("parseVideoUrlMetadata: URL with codec and resolution", () => {
  const result = parseVideoUrlMetadata(
    "https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/1280x720/abc.mp4",
  );
  assertEquals(result, { width: 1280, height: 720, videoCodec: "H.264" });
});

Deno.test("parseVideoUrlMetadata: URL with av01 codec", () => {
  const result = parseVideoUrlMetadata(
    "https://video.twimg.com/ext_tw_video/123/pu/vid/av01/1920x1080/abc.mp4",
  );
  assertEquals(result, { width: 1920, height: 1080, videoCodec: "AV1" });
});

Deno.test("parseVideoUrlMetadata: URL with unknown codec passes through", () => {
  const result = parseVideoUrlMetadata(
    "https://video.twimg.com/ext_tw_video/123/pu/vid/vp09/640x360/abc.mp4",
  );
  assertEquals(result, { width: 640, height: 360, videoCodec: "vp09" });
});

Deno.test("parseVideoUrlMetadata: URL without codec (old format)", () => {
  const result = parseVideoUrlMetadata(
    "https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/abc.mp4",
  );
  assertEquals(result, { width: 720, height: 1280 });
});

Deno.test("parseVideoUrlMetadata: URL without resolution returns undefined", () => {
  const result = parseVideoUrlMetadata("https://video.twimg.com/ext_tw_video/123/abc.mp4");
  assertEquals(result, undefined);
});

// ─── extractMediaInfo tests ───────────────────────────────────

Deno.test("extractMediaInfo: standard tweet with video", () => {
  const tweetData = makeTweetData([
    {
      type: "video",
      media_url_https: "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
      video_info: {
        aspect_ratio: [16, 9],
        duration_millis: 30000,
        variants: [
          {
            content_type: "video/mp4",
            bitrate: 2176000,
            url: "https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/1280x720/high.mp4",
          },
          {
            content_type: "video/mp4",
            bitrate: 832000,
            url: "https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/640x360/medium.mp4",
          },
          {
            content_type: "application/x-mpegURL",
            url: "https://video.twimg.com/ext_tw_video/123/pu/pl/playlist.m3u8",
          },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);

  // Existing assertions preserved
  assertEquals(result.length, 3);
  assertEquals(result[0].quality, "HLS");
  assertEquals(
    result[0].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
  );
  assertEquals(result[1].quality, "2176000");
  assertEquals(
    result[1].videoUrl,
    "https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/1280x720/high.mp4",
  );
  assertEquals(
    result[1].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
  );
  assertEquals(result[2].quality, "832000");
  assertEquals(
    result[2].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
  );

  // New field assertions
  assertEquals(result[0].aspectRatio, [16, 9]);
  assertEquals(result[0].durationMs, 30000);

  assertEquals(result[1].width, 1280);
  assertEquals(result[1].height, 720);
  assertEquals(result[1].videoCodec, "H.264");
  assertEquals(result[1].audioCodec, "AAC");
  assertEquals(result[1].aspectRatio, [16, 9]);
  assertEquals(result[1].durationMs, 30000);

  assertEquals(result[2].width, 640);
  assertEquals(result[2].height, 360);
  assertEquals(result[2].videoCodec, "H.264");
  assertEquals(result[2].audioCodec, "AAC");
});

Deno.test("extractMediaInfo: animated_gif", () => {
  const tweetData = makeTweetData([
    {
      type: "animated_gif",
      media_url_https: "https://pbs.twimg.com/tweet_video_thumb/gif_thumb.jpg",
      video_info: {
        variants: [
          {
            content_type: "video/mp4",
            bitrate: 0,
            url: "https://video.twimg.com/tweet_video/gif.mp4",
          },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);
  assertEquals(result.length, 1);
  assertEquals(result[0].videoUrl, "https://video.twimg.com/tweet_video/gif.mp4");
  assertEquals(result[0].thumbnailUrl, "https://pbs.twimg.com/tweet_video_thumb/gif_thumb.jpg");
  // animated_gif: no aspect_ratio / duration in video_info
  assertEquals(result[0].aspectRatio, undefined);
  assertEquals(result[0].durationMs, undefined);
  assertEquals(result[0].audioCodec, "AAC");
});

Deno.test("extractMediaInfo: TweetWithVisibilityResults", () => {
  const tweetData = makeTweetData(
    [
      {
        type: "video",
        media_url_https: "https://pbs.twimg.com/ext_tw_video_thumb/456/pu/img/restricted_thumb.jpg",
        video_info: {
          aspect_ratio: [9, 16],
          duration_millis: 15000,
          variants: [
            {
              content_type: "video/mp4",
              bitrate: 1000000,
              url: "https://video.twimg.com/ext_tw_video/456/pu/vid/avc1/480x852/restricted.mp4",
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
  assertEquals(
    result[0].videoUrl,
    "https://video.twimg.com/ext_tw_video/456/pu/vid/avc1/480x852/restricted.mp4",
  );
  assertEquals(
    result[0].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/456/pu/img/restricted_thumb.jpg",
  );
  assertEquals(result[0].width, 480);
  assertEquals(result[0].height, 852);
  assertEquals(result[0].aspectRatio, [9, 16]);
  assertEquals(result[0].durationMs, 15000);
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
        aspect_ratio: [16, 9],
        duration_millis: 60000,
        variants: [
          {
            content_type: "video/mp4",
            bitrate: 256000,
            url: "https://video.twimg.com/ext_tw_video/789/pu/vid/avc1/480x270/low.mp4",
          },
          {
            content_type: "video/mp4",
            bitrate: 2176000,
            url: "https://video.twimg.com/ext_tw_video/789/pu/vid/avc1/1280x720/high.mp4",
          },
          {
            content_type: "video/mp4",
            bitrate: 832000,
            url: "https://video.twimg.com/ext_tw_video/789/pu/vid/avc1/640x360/medium.mp4",
          },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);
  // Existing sort assertions preserved
  assertEquals(result[0].quality, "2176000");
  assertEquals(
    result[0].thumbnailUrl,
    "https://pbs.twimg.com/ext_tw_video_thumb/789/pu/img/sort_thumb.jpg",
  );
  assertEquals(result[1].quality, "832000");
  assertEquals(result[2].quality, "256000");

  // New: resolution extracted correctly per variant
  assertEquals(result[0].width, 1280);
  assertEquals(result[0].height, 720);
  assertEquals(result[1].width, 640);
  assertEquals(result[1].height, 360);
  assertEquals(result[2].width, 480);
  assertEquals(result[2].height, 270);
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
            url: "https://video.twimg.com/ext_tw_video/999/pu/vid/avc1/640x360/no_thumb.mp4",
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
          {
            content_type: "video/mp4",
            bitrate: 1000000,
            url: "https://video.twimg.com/ext_tw_video/000/pu/vid/avc1/640x360/test.mp4",
          },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);
  assertEquals(result.length, 1);
  assertEquals(result[0].thumbnailUrl, undefined);
});

Deno.test("extractMediaInfo: URL without resolution falls back gracefully", () => {
  const tweetData = makeTweetData([
    {
      type: "video",
      media_url_https: "https://pbs.twimg.com/ext_tw_video_thumb/111/pu/img/thumb.jpg",
      video_info: {
        aspect_ratio: [1, 1],
        duration_millis: 5000,
        variants: [
          {
            content_type: "video/mp4",
            bitrate: 500000,
            url: "https://video.twimg.com/ext_tw_video/111/fallback.mp4",
          },
        ],
      },
    },
  ]);

  const result = extractMediaInfo(tweetData);
  assertEquals(result.length, 1);
  assertEquals(result[0].width, undefined);
  assertEquals(result[0].height, undefined);
  assertEquals(result[0].videoCodec, undefined);
  assertEquals(result[0].audioCodec, "AAC");
  assertEquals(result[0].aspectRatio, [1, 1]);
  assertEquals(result[0].durationMs, 5000);
});
