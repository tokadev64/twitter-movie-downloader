import { expect, test } from "bun:test";

import { parseVideoUrlMetadata } from "../extract-media-info.ts";
import { extractTweetId } from "../extract-tweet-id.ts";
import { sanitizeOutputPath } from "../sanitize-output-path.ts";
import type { VideoVariant } from "../types.ts";
import { isAllowedVideoHost } from "../validate-video-url.ts";
import {
  brokenCodecMapSwapped,
  brokenExtractNoTrim,
  brokenHostErrorFailsOpen,
  brokenHostSubstringMatch,
  brokenMediaSortAscending,
  brokenSanitizeNoBasename,
} from "./broken-variants.ts";
import {
  expectCodecLabel,
  mp4BitrateDescending,
  predictMediaOrder,
  predictOutputPath,
} from "./invariants.ts";

test("brokenExtractNoTrim が INV-ID-TRIM を壊す証跡", () => {
  expect(extractTweetId(" 123 ")).toEqual("123");
  expect(() => brokenExtractNoTrim(" 123 ")).toThrow("Invalid Twitter/X URL");
});

test("brokenSanitizeNoBasename が INV-OUT-NO-SLASH を壊す証跡", () => {
  const real = sanitizeOutputPath("../../etc/passwd", "1");
  const broken = brokenSanitizeNoBasename("../../etc/passwd", "1");
  expect(real.includes("/")).toEqual(false);
  expect(broken.includes("/")).toEqual(true);
  expect(real).toEqual(predictOutputPath("../../etc/passwd", "1"));
  expect(broken).not.toEqual(predictOutputPath("../../etc/passwd", "1"));
});

test("brokenMediaSortAscending が INV-MP4-DESC を壊す証跡", () => {
  const variants: VideoVariant[] = [
    { url: "https://video.twimg.com/a.mp4", content_type: "video/mp4", bitrate: 256000 },
    { url: "https://video.twimg.com/b.mp4", content_type: "video/mp4", bitrate: 832000 },
    { url: "https://video.twimg.com/c.m3u8", content_type: "application/x-mpegURL" },
  ];
  const real = predictMediaOrder(variants);
  const broken = brokenMediaSortAscending(variants);
  expect(real.map((e) => e.quality)).toEqual(["HLS", "832000", "256000"]);
  expect(broken.map((e) => e.quality)).toEqual(["HLS", "256000", "832000"]);
  expect(
    mp4BitrateDescending(broken.map((e) => ({ videoUrl: e.videoUrl, quality: e.quality }))),
  ).toEqual(false);
});

test("brokenCodecMapSwapped が INV-CODEC-PARSE を壊す証跡", () => {
  const url = "https://video.twimg.com/x/vid/avc1/1280x720/a.mp4";
  const real = parseVideoUrlMetadata(url);
  const broken = brokenCodecMapSwapped(url);
  expect(real).toEqual({ width: 1280, height: 720, videoCodec: expectCodecLabel("avc1") });
  expect(broken).not.toEqual(real);
  expect(broken?.videoCodec).toEqual("AV1");
});

test("brokenHostSubstringMatch が INV-HOST-EXACT を壊す証跡", () => {
  const url = "https://video.twimg.com.evil.io/a.mp4";
  expect(isAllowedVideoHost(url)).toEqual(false);
  expect(brokenHostSubstringMatch(url)).toEqual(true);
});

test("brokenHostErrorFailsOpen が INV-HOST-EXACT を壊す証跡", () => {
  const url = "not a url";
  expect(isAllowedVideoHost(url)).toEqual(false);
  expect(brokenHostErrorFailsOpen(url)).toEqual(true);
});
