import { expect, test } from "bun:test";

import fc from "fast-check";

import { sanitizeOutputPath } from "./sanitize-output-path.ts";

test("sanitizeOutputPath: default filename when undefined", () => {
  expect(sanitizeOutputPath(undefined, "123456")).toEqual("twitter_video_123456.mp4");
});

test("sanitizeOutputPath: preserves simple filename", () => {
  expect(sanitizeOutputPath("my_video.mp4", "123456")).toEqual("my_video.mp4");
});

test("sanitizeOutputPath: prevents path traversal with ../", () => {
  expect(sanitizeOutputPath("../../etc/passwd", "123456")).toEqual("passwd.mp4");
});

test("sanitizeOutputPath: prevents absolute path", () => {
  expect(sanitizeOutputPath("/tmp/evil.mp4", "123456")).toEqual("evil.mp4");
});

test("sanitizeOutputPath: handles nested path traversal", () => {
  expect(sanitizeOutputPath("../../../tmp/malicious.mp4", "123456")).toEqual("malicious.mp4");
});

test("sanitizeOutputPath: default filename uses .mp4", () => {
  expect(sanitizeOutputPath(undefined, "123456", "mp4")).toEqual("twitter_video_123456.mp4");
});

test("sanitizeOutputPath: format defaults to mp4 when omitted", () => {
  expect(sanitizeOutputPath(undefined, "123456")).toEqual("twitter_video_123456.mp4");
});

test("sanitizeOutputPath: root path '/' falls back to default", () => {
  expect(sanitizeOutputPath("/", "123456")).toEqual("twitter_video_123456.mp4");
});

// --- PBT ---

const digitIdArb = fc.string({
  unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
  minLength: 1,
  maxLength: 20,
});

test("PBT: sanitizeOutputPath never contains path separators when path is provided", () => {
  fc.assert(
    fc.property(fc.string({ minLength: 1 }), digitIdArb, (path, tweetId) => {
      const result = sanitizeOutputPath(path, tweetId);
      expect(result.includes("/")).toEqual(false);
    }),
  );
});

test("PBT: sanitizeOutputPath default filename uses tweetId (numeric ID only)", () => {
  fc.assert(
    fc.property(digitIdArb, (tweetId) => {
      const result = sanitizeOutputPath(undefined, tweetId);
      expect(result).toEqual(`twitter_video_${tweetId}.mp4`);
      expect(result.includes("/")).toEqual(false);
    }),
  );
});

test("PBT: sanitizeOutputPath always ends with .mp4", () => {
  fc.assert(
    fc.property(fc.string({ minLength: 1 }), digitIdArb, (path, tweetId) => {
      const result = sanitizeOutputPath(path, tweetId, "mp4");
      expect(result.endsWith(".mp4")).toEqual(true);
    }),
  );
});

test("PBT: sanitizeOutputPath returns non-empty string", () => {
  fc.assert(
    fc.property(fc.option(fc.string(), { nil: undefined }), digitIdArb, (path, tweetId) => {
      const result = sanitizeOutputPath(path, tweetId);
      expect(result.length > 0).toEqual(true);
    }),
  );
});
