import { expect, test } from "bun:test";

import fc from "fast-check";

import { isAllowedVideoHost, validateVideoUrl } from "./validate-video-url.ts";

test("validateVideoUrl: accepts valid HTTPS URL", () => {
  validateVideoUrl("https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/abc.mp4");
});

test("validateVideoUrl: throws on HTTP URL", () => {
  expect(() => validateVideoUrl("http://video.twimg.com/video.mp4")).toThrow(
    "Invalid video URL: HTTPS required",
  );
});

test("validateVideoUrl: throws on empty string", () => {
  expect(() => validateVideoUrl("")).toThrow("Invalid video URL: HTTPS required");
});

test("validateVideoUrl: throws on relative path", () => {
  expect(() => validateVideoUrl("/path/to/video.mp4")).toThrow("Invalid video URL: HTTPS required");
});

// --- isAllowedVideoHost ---

test("isAllowedVideoHost: allows video.twimg.com", () => {
  expect(isAllowedVideoHost("https://video.twimg.com/ext_tw_video/123/vid.mp4")).toEqual(true);
});

test("isAllowedVideoHost: allows pbs.twimg.com", () => {
  expect(isAllowedVideoHost("https://pbs.twimg.com/thumb.jpg")).toEqual(true);
});

test("isAllowedVideoHost: rejects unknown host", () => {
  expect(isAllowedVideoHost("https://evil.com/video.mp4")).toEqual(false);
});

test("isAllowedVideoHost: rejects invalid URL", () => {
  expect(isAllowedVideoHost("not-a-url")).toEqual(false);
});

// --- PBT ---

test("PBT: validateVideoUrl always throws for non-HTTPS URLs", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("http://", "ftp://", "ws://", "file://", "data:", ""),
      fc.webUrl().map((url) => new URL(url).pathname),
      (scheme, path) => {
        const url = `${scheme}${path}`;
        if (!url.startsWith("https://")) {
          expect(() => validateVideoUrl(url)).toThrow("HTTPS required");
        }
      },
    ),
  );
});
