import { expect, test } from "bun:test";

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

test("parseVideoUrlMetadata: URL with codec and resolution", () => {
  const result = parseVideoUrlMetadata(
    "https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/1280x720/abc.mp4",
  );
  expect(result).toEqual({ width: 1280, height: 720, videoCodec: "H.264" });
});

test("parseVideoUrlMetadata: URL with av01 codec", () => {
  const result = parseVideoUrlMetadata(
    "https://video.twimg.com/ext_tw_video/123/pu/vid/av01/1920x1080/abc.mp4",
  );
  expect(result).toEqual({ width: 1920, height: 1080, videoCodec: "AV1" });
});

test("parseVideoUrlMetadata: URL with unknown codec passes through", () => {
  const result = parseVideoUrlMetadata(
    "https://video.twimg.com/ext_tw_video/123/pu/vid/vp09/640x360/abc.mp4",
  );
  expect(result).toEqual({ width: 640, height: 360, videoCodec: "vp09" });
});

test("parseVideoUrlMetadata: URL without codec (old format)", () => {
  const result = parseVideoUrlMetadata(
    "https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/abc.mp4",
  );
  expect(result).toEqual({ width: 720, height: 1280 });
});

test("parseVideoUrlMetadata: URL without resolution returns undefined", () => {
  const result = parseVideoUrlMetadata("https://video.twimg.com/ext_tw_video/123/abc.mp4");
  expect(result).toEqual(undefined);
});

// ─── extractMediaInfo tests ───────────────────────────────────

test("extractMediaInfo: standard tweet with video", () => {
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
  expect(result.length).toEqual(3);
  expect(result[0].quality).toEqual("HLS");
  expect(result[0].thumbnailUrl).toEqual(
    "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
  );
  expect(result[1].quality).toEqual("2176000");
  expect(result[1].videoUrl).toEqual(
    "https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/1280x720/high.mp4",
  );
  expect(result[1].thumbnailUrl).toEqual(
    "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
  );
  expect(result[2].quality).toEqual("832000");
  expect(result[2].thumbnailUrl).toEqual(
    "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/thumb.jpg",
  );

  // New field assertions
  expect(result[0].aspectRatio).toEqual([16, 9]);
  expect(result[0].durationMs).toEqual(30000);

  expect(result[1].width).toEqual(1280);
  expect(result[1].height).toEqual(720);
  expect(result[1].videoCodec).toEqual("H.264");
  expect(result[1].audioCodec).toEqual("AAC");
  expect(result[1].aspectRatio).toEqual([16, 9]);
  expect(result[1].durationMs).toEqual(30000);

  expect(result[2].width).toEqual(640);
  expect(result[2].height).toEqual(360);
  expect(result[2].videoCodec).toEqual("H.264");
  expect(result[2].audioCodec).toEqual("AAC");
});

test("extractMediaInfo: animated_gif", () => {
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
  expect(result.length).toEqual(1);
  expect(result[0].videoUrl).toEqual("https://video.twimg.com/tweet_video/gif.mp4");
  expect(result[0].thumbnailUrl).toEqual("https://pbs.twimg.com/tweet_video_thumb/gif_thumb.jpg");
  // animated_gif: no aspect_ratio / duration in video_info
  expect(result[0].aspectRatio).toEqual(undefined);
  expect(result[0].durationMs).toEqual(undefined);
  expect(result[0].audioCodec).toEqual("AAC");
});

test("extractMediaInfo: TweetWithVisibilityResults", () => {
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
  expect(result.length).toEqual(1);
  expect(result[0].videoUrl).toEqual(
    "https://video.twimg.com/ext_tw_video/456/pu/vid/avc1/480x852/restricted.mp4",
  );
  expect(result[0].thumbnailUrl).toEqual(
    "https://pbs.twimg.com/ext_tw_video_thumb/456/pu/img/restricted_thumb.jpg",
  );
  expect(result[0].width).toEqual(480);
  expect(result[0].height).toEqual(852);
  expect(result[0].aspectRatio).toEqual([9, 16]);
  expect(result[0].durationMs).toEqual(15000);
});

test("extractMediaInfo: TweetTombstone throws", () => {
  const tweetData = {
    data: { tweetResult: { result: { __typename: "TweetTombstone" } } },
  };
  expect(() => extractMediaInfo(tweetData)).toThrow("Tweet is not available");
});

test("extractMediaInfo: no media throws", () => {
  const tweetData = {
    data: { tweetResult: { result: { __typename: "Tweet", legacy: { entities: {} } } } },
  };
  expect(() => extractMediaInfo(tweetData)).toThrow("No media found in tweet");
});

test("extractMediaInfo: empty data throws", () => {
  expect(() => extractMediaInfo({})).toThrow("Tweet data not available");
});

test("extractMediaInfo: photo-only tweet returns empty", () => {
  const tweetData = makeTweetData([{ type: "photo" }]);
  const result = extractMediaInfo(tweetData);
  expect(result.length).toEqual(0);
});

test("extractMediaInfo: MP4 sorted by bitrate descending", () => {
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
  expect(result[0].quality).toEqual("2176000");
  expect(result[0].thumbnailUrl).toEqual(
    "https://pbs.twimg.com/ext_tw_video_thumb/789/pu/img/sort_thumb.jpg",
  );
  expect(result[1].quality).toEqual("832000");
  expect(result[2].quality).toEqual("256000");

  // New: resolution extracted correctly per variant
  expect(result[0].width).toEqual(1280);
  expect(result[0].height).toEqual(720);
  expect(result[1].width).toEqual(640);
  expect(result[1].height).toEqual(360);
  expect(result[2].width).toEqual(480);
  expect(result[2].height).toEqual(270);
});

test("extractMediaInfo: missing media_url_https returns undefined thumbnailUrl", () => {
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
  expect(result.length).toEqual(1);
  expect(result[0].thumbnailUrl).toEqual(undefined);
});

test("extractMediaInfo: non-HTTPS media_url_https is filtered out", () => {
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
  expect(result.length).toEqual(1);
  expect(result[0].thumbnailUrl).toEqual(undefined);
});

test("extractMediaInfo: URL without resolution falls back gracefully", () => {
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
  expect(result.length).toEqual(1);
  expect(result[0].width).toEqual(undefined);
  expect(result[0].height).toEqual(undefined);
  expect(result[0].videoCodec).toEqual(undefined);
  expect(result[0].audioCodec).toEqual("AAC");
  expect(result[0].aspectRatio).toEqual([1, 1]);
  expect(result[0].durationMs).toEqual(5000);
});
