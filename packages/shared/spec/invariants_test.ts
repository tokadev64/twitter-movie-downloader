import { expect, test } from "bun:test";

import fc from "fast-check";

import { extractMediaInfo, parseVideoUrlMetadata } from "../extract-media-info.ts";
import { extractTweetId } from "../extract-tweet-id.ts";
import { sanitizeOutputPath } from "../sanitize-output-path.ts";
import { isAllowedVideoHost, validateVideoUrl } from "../validate-video-url.ts";
import {
  buildTweetUrl,
  expectCodecLabel,
  hlsAtMostOneFirst,
  mp4BitrateDescending,
  predictMediaOrder,
  predictOutputPath,
} from "./invariants.ts";

const digitArb = fc.string({
  unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
  minLength: 1,
  maxLength: 20,
});
const usernameArb = fc
  .string({ unit: "grapheme-ascii", minLength: 1, maxLength: 15 })
  .filter((s) => /^\w+$/.test(s));
const whitespaceArb = fc.string({
  unit: fc.constantFrom(" ", "\t", "\n"),
  minLength: 0,
  maxLength: 3,
});

// ─── extractTweetId: INV-ID-* ─────────────────────────────────

test("INV-ID-TRIM: 前後空白は結果に影響しない (PBT)", () => {
  fc.assert(
    fc.property(digitArb, whitespaceArb, whitespaceArb, (id, pre, post) => {
      expect(extractTweetId(`${pre}${id}${post}`)).toEqual(id);
    }),
  );
  fc.assert(
    fc.property(
      digitArb,
      usernameArb,
      fc.constantFrom("twitter.com", "x.com", "mobile.twitter.com"),
      whitespaceArb,
      whitespaceArb,
      (id, username, domain, pre, post) => {
        const url = `${pre}${buildTweetUrl(domain, username, id)}${post}`;
        expect(extractTweetId(url)).toEqual(id);
      },
    ),
  );
});

test("INV-ID-EMBEDDED (CQ1): tweet-like 部分文字列が他に埋まっていても id を抜く (現状契約)", () => {
  const hosts = [
    "https://evil.example",
    "http://evil.example",
    "garbage",
    "",
    "https://evil.twitter.com.",
    "https://evil.x.com.",
    "https://share.example/redirect?to=",
  ];
  fc.assert(
    fc.property(
      digitArb,
      usernameArb,
      fc.constantFrom(...hosts),
      fc.constantFrom("twitter.com", "x.com", "mobile.twitter.com"),
      fc.constantFrom("", "?s=20", "#xyz"),
      (id, username, prefix, domain, suffix) => {
        const core = `${domain}/${username}/status/${id}`;
        expect(extractTweetId(`${prefix}#${core}${suffix}`)).toEqual(id);
      },
    ),
  );
  expect(extractTweetId("https://evil.example/twitter.com/user/status/123")).toEqual("123");
  expect(extractTweetId("https://evil.x.com/u/status/7")).toEqual("7");
});

test("INV-ID-TAIL (現状契約): 末尾 garbage は桁部分だけ抜く / 数字直入力の garbage 混入は拒否", () => {
  fc.assert(
    fc.property(
      digitArb,
      usernameArb,
      fc
        .string({ unit: "grapheme-ascii", minLength: 1, maxLength: 8 })
        .filter((s) => /^\w+$/.test(s)),
      (id, username, tail) => {
        const idPrefix = `${id}${tail}`.match(/^\d+/)?.[0] ?? id;
        const url = `https://x.com/${username}/status/${id}${tail}`;
        expect(extractTweetId(url)).toEqual(idPrefix);
      },
    ),
  );
  expect(() => extractTweetId("123abc")).toThrow("Invalid Twitter/X URL");
});

test("INV-ID-REJECT: /status/<digits> を含まず数字のみでもない入力は常に throw (PBT)", () => {
  fc.assert(
    fc.property(
      fc
        .string({ unit: "grapheme", minLength: 0, maxLength: 40 })
        .filter((s) => !/status\/\d+/.test(s) && !/^\d+$/.test(s.trim())),
      (input) => {
        expect(() => extractTweetId(input)).toThrow("Invalid Twitter/X URL");
      },
    ),
  );
});

// ─── sanitizeOutputPath: INV-OUT-* ────────────────────────────

const outInputArb = fc.oneof(
  fc.constant(undefined),
  fc.webPath(),
  fc.constantFrom(
    "../../etc/passwd",
    "vid",
    "a.tar.gz",
    ".",
    "..",
    "/",
    "\\",
    "",
    "C:\\path\\vid.mp4",
  ),
  fc.string({ unit: "grapheme-ascii", minLength: 1, maxLength: 30 }),
);

test("INV-OUT-EQUIV: predictOutputPath と完全一致 (PBT)", () => {
  fc.assert(
    fc.property(outInputArb, digitArb, (input, tweetId) => {
      expect(sanitizeOutputPath(input, tweetId)).toEqual(predictOutputPath(input, tweetId));
    }),
  );
});

test("INV-OUT-NO-SLASH / INV-OUT-EXT: 結果に / を含まず .mp4 終わり (PBT)", () => {
  fc.assert(
    fc.property(outInputArb, digitArb, (input, tweetId) => {
      const result = sanitizeOutputPath(input, tweetId);
      expect(result.includes("/")).toEqual(false);
      expect(result.endsWith(".mp4")).toEqual(true);
    }),
  );
});

test("INV-OUT-DEFAULT / 暗黙エッジ: 台帳 §4 の例をロック", () => {
  expect(sanitizeOutputPath(undefined, "1")).toEqual("twitter_video_1.mp4");
  expect(sanitizeOutputPath("", "1")).toEqual("twitter_video_1.mp4");
  expect(sanitizeOutputPath("/", "1")).toEqual("twitter_video_1.mp4");
  expect(sanitizeOutputPath("\\", "1")).toEqual("twitter_video_1.mp4");
  expect(sanitizeOutputPath(".", "1")).toEqual("..mp4");
  expect(sanitizeOutputPath("..", "1")).toEqual("...mp4");
  expect(sanitizeOutputPath("a/", "1")).toEqual("a.mp4");
  expect(sanitizeOutputPath("a.tar.gz", "1")).toEqual("a.tar.mp4");
  expect(sanitizeOutputPath("C:\\path\\vid.mp4", "1")).toEqual("C:\\path\\vid.mp4");
});

// ─── validate-video-url: INV-HTTPS-ONLY / INV-HOST-EXACT ──────

test("INV-HTTPS-ONLY: https:// 開始のみ成功 (PBT)", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("http://", "ftp://", "HTTPS://", "https:/", "", "https:"),
      fc.webUrl().map((u) => u.replace(/^https:\/\//, "")),
      (scheme, rest) => {
        const url = `${scheme}${rest}`;
        if (url.startsWith("https://")) {
          expect(validateVideoUrl(url)).toEqual(undefined);
        } else {
          expect(() => validateVideoUrl(url)).toThrow("Invalid video URL: HTTPS required");
        }
      },
    ),
  );
  expect(validateVideoUrl("https://evil.example/v.mp4")).toEqual(undefined);
});

test("INV-HOST-EXACT: 完全一致のみ true / parse 失敗は false (PBT)", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("video.twimg.com", "pbs.twimg.com"),
      fc.constantFrom("", ":443", ":8443"),
      fc.constantFrom("/a.mp4", "/x/vid/avc1/1280x720/a.mp4"),
      fc.boolean(),
      (host, port, path, upper) => {
        const shown = upper ? host.toUpperCase() : host;
        const result = isAllowedVideoHost(`https://${shown}${port}${path}`);
        expect(result).toEqual(true);
      },
    ),
  );
  fc.assert(
    fc.property(
      fc.constantFrom(
        "video.twimg.com.evil.io",
        "evilvideo.twimg.com",
        "sub.video.twimg.com",
        "pbs.twimg.com",
        "x.com",
      ),
      (host) => {
        const expected = host === "pbs.twimg.com";
        expect(isAllowedVideoHost(`https://${host}/a.mp4`)).toEqual(expected);
      },
    ),
  );
  fc.assert(
    fc.property(
      fc.string({ unit: "grapheme", minLength: 0, maxLength: 30 }).filter((s) => {
        try {
          new URL(s);
          return false;
        } catch {
          return true;
        }
      }),
      (bad) => {
        expect(isAllowedVideoHost(bad)).toEqual(false);
      },
    ),
  );
});

// ─── extractMediaInfo: INV-MEDIA-PREDICT / PROP-ITEM-METADATA ──

// oxlint-disable-next-line typescript/no-explicit-any -- Twitter API response has complex dynamic structure
function makeTweetData(media: unknown[], typename = "Tweet"): any {
  return {
    data: { tweetResult: { result: { __typename: typename, legacy: { entities: { media } } } } },
  };
}

const variantArb = fc.record({
  url: fc.oneof(
    fc.webUrl().filter((u) => u.startsWith("https://")),
    fc
      .webUrl()
      .filter((u) => u.startsWith("https://"))
      .map((u) => `${u}/vid/avc1/1280x720/a.mp4`),
  ),
  content_type: fc.constantFrom(
    "video/mp4",
    "application/x-mpegURL",
    "application/x-mpegURL",
    "other",
  ),
  bitrate: fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: undefined }),
});
const variantsArb = fc.uniqueArray(variantArb, {
  minLength: 0,
  maxLength: 6,
  selector: (v) => v.url,
});

test("INV-MEDIA-PREDICT: 出力は predictMediaOrder と完全一致 (PBT)", () => {
  fc.assert(
    fc.property(variantsArb, (variants) => {
      const item = {
        type: "video",
        media_url_https: "https://pbs.twimg.com/thumb.jpg",
        video_info: { aspect_ratio: [16, 9], duration_millis: 1000, variants },
      };
      const list = extractMediaInfo(makeTweetData([item]));
      expect(list.map((m) => ({ videoUrl: m.videoUrl, quality: m.quality }))).toEqual(
        predictMediaOrder(variants),
      );
      expect(mp4BitrateDescending(list)).toEqual(true);
      expect(hlsAtMostOneFirst(list)).toEqual(true);
    }),
  );
});

test("PROP-ITEM-METADATA: item レベル値は全条目へ同一値で伝搬 (PBT)", () => {
  fc.assert(
    fc.property(
      variantsArb,
      fc.option(fc.tuple(fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 })), {
        nil: undefined,
      }),
      fc.option(fc.integer({ min: 0, max: 60_000 }), { nil: undefined }),
      fc.constantFrom("https://pbs.twimg.com/thumb.jpg", "http://evil.example/thumb.jpg"),
      (variants, aspect, duration, thumb) => {
        const item = {
          type: "video",
          media_url_https: thumb,
          video_info: { aspect_ratio: aspect, duration_millis: duration, variants },
        };
        const list = extractMediaInfo(makeTweetData([item]));
        const expectedAspect: [number, number] | undefined = aspect
          ? [aspect[0], aspect[1]]
          : undefined;
        for (const entry of list) {
          expect(entry.aspectRatio).toEqual(expectedAspect);
          expect(entry.durationMs).toEqual(duration);
          expect(entry.thumbnailUrl).toEqual(thumb.startsWith("https://") ? thumb : undefined);
          if (entry.quality !== "HLS") expect(entry.audioCodec).toEqual("AAC");
        }
      },
    ),
  );
});

test("INV-COUNT-TYPES: photo / tombstone / 空 media の失敗と 0 件をロック", () => {
  expect(extractMediaInfo(makeTweetData([{ type: "photo" }]))).toEqual([]);
  expect(() => extractMediaInfo(makeTweetData([], "TweetTombstone"))).toThrow(
    "Tweet is not available (deleted, protected, or restricted)",
  );
  expect(() => extractMediaInfo({ data: {} })).toThrow("Tweet data not available");
  expect(extractMediaInfo(makeTweetData([]))).toEqual([]);
  expect(() =>
    extractMediaInfo({ data: { tweetResult: { result: { legacy: { entities: {} } } } } }),
  ).toThrow("No media found in tweet");
});

test("暗黙クラッシュ: video_info 欠落は TypeError (独自エラーではない・現状ロック)", () => {
  expect(() => extractMediaInfo(makeTweetData([{ type: "video" }]))).toThrow(TypeError);
});

// ─── parseVideoUrlMetadata: INV-CODEC-PARSE ───────────────────

const codecArb = fc.constantFrom("avc1", "av01", "vp09", "hev1", "hvc1", "mp4a", "123", "a1");
const dimsArb = fc.tuple(fc.integer({ min: 1, max: 4096 }), fc.integer({ min: 1, max: 4096 }));
const noiseArb = fc.constantFrom("", "prefix", "suffix.mp4", "a/b/");

test("INV-CODEC-PARSE: 2 パターンと CODEC_MAP を PBT でロック (部分文字列一致)", () => {
  fc.assert(
    fc.property(noiseArb, codecArb, dimsArb, noiseArb, (pre, codec, [w, h], post) => {
      const url = `${pre}/vid/${codec}/${w}x${h}/${post}`;
      expect(parseVideoUrlMetadata(url)).toEqual({
        width: w,
        height: h,
        videoCodec: expectCodecLabel(codec),
      });
    }),
  );
  fc.assert(
    fc.property(noiseArb, dimsArb, noiseArb, (pre, [w, h], post) => {
      const url = `${pre}/vid/${w}x${h}/${post}`;
      expect(parseVideoUrlMetadata(url)).toEqual({ width: w, height: h });
    }),
  );
  fc.assert(
    fc.property(
      fc
        .string({ unit: "grapheme-ascii", minLength: 0, maxLength: 40 })
        .filter((s) => !s.includes("/vid/")),
      (url) => {
        expect(parseVideoUrlMetadata(url)).toEqual(undefined);
      },
    ),
  );
});

test("INV-CODEC-PARSE(優先・現状ロック): 数字だけ codec 文字列には codec 枝が勝つ", () => {
  expect(parseVideoUrlMetadata("https://v/vid/123/45x67/x.mp4")).toEqual({
    width: 45,
    height: 67,
    videoCodec: "123",
  });
});
