import { assertEquals } from "jsr:@std/assert";
import fc from "npm:fast-check";
import { sanitizeOutputPath } from "./sanitize-output-path.ts";

Deno.test("sanitizeOutputPath: default filename when undefined", () => {
  assertEquals(sanitizeOutputPath(undefined, "123456"), "twitter_video_123456.mp4");
});

Deno.test("sanitizeOutputPath: preserves simple filename", () => {
  assertEquals(sanitizeOutputPath("my_video.mp4", "123456"), "my_video.mp4");
});

Deno.test("sanitizeOutputPath: prevents path traversal with ../", () => {
  assertEquals(sanitizeOutputPath("../../etc/passwd", "123456"), "passwd.mp4");
});

Deno.test("sanitizeOutputPath: prevents absolute path", () => {
  assertEquals(sanitizeOutputPath("/tmp/evil.mp4", "123456"), "evil.mp4");
});

Deno.test("sanitizeOutputPath: handles nested path traversal", () => {
  assertEquals(sanitizeOutputPath("../../../tmp/malicious.mp4", "123456"), "malicious.mp4");
});

// --- format parameter tests ---

Deno.test("sanitizeOutputPath: default filename uses .mp4 when format is mp4", () => {
  assertEquals(sanitizeOutputPath(undefined, "123456", "mp4"), "twitter_video_123456.mp4");
});

Deno.test("sanitizeOutputPath: default filename uses .mov when format is mov", () => {
  assertEquals(sanitizeOutputPath(undefined, "123456", "mov"), "twitter_video_123456.mov");
});

Deno.test("sanitizeOutputPath: format defaults to mp4 when omitted", () => {
  assertEquals(sanitizeOutputPath(undefined, "123456"), "twitter_video_123456.mp4");
});

Deno.test("sanitizeOutputPath: format replaces extension when path is provided", () => {
  assertEquals(sanitizeOutputPath("video.mp4", "123456", "mov"), "video.mov");
});

Deno.test("sanitizeOutputPath: format replaces extension with path traversal", () => {
  assertEquals(sanitizeOutputPath("../../dir/video.mp4", "123456", "mov"), "video.mov");
});

Deno.test("sanitizeOutputPath: preserves filename without extension when format specified", () => {
  assertEquals(sanitizeOutputPath("video_no_ext", "123456", "mov"), "video_no_ext.mov");
});

Deno.test("sanitizeOutputPath: root path '/' falls back to default", () => {
  assertEquals(sanitizeOutputPath("/", "123456"), "twitter_video_123456.mp4");
});

// --- PBT ---

const digitIdArb = fc.string({
  unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
  minLength: 1,
  maxLength: 20,
});

Deno.test("PBT: sanitizeOutputPath never contains path separators when path is provided", () => {
  fc.assert(
    fc.property(fc.string({ minLength: 1 }), digitIdArb, (path, tweetId) => {
      const result = sanitizeOutputPath(path, tweetId);
      // セキュリティ不変条件: パス指定時、basename により / を含まない
      assertEquals(result.includes("/"), false);
    }),
  );
});

Deno.test("PBT: sanitizeOutputPath default filename uses tweetId (numeric ID only)", () => {
  fc.assert(
    fc.property(digitIdArb, (tweetId) => {
      const result = sanitizeOutputPath(undefined, tweetId);
      // デフォルトファイル名に tweetId が含まれ、パス区切りを含まない
      assertEquals(result, `twitter_video_${tweetId}.mp4`);
      assertEquals(result.includes("/"), false);
    }),
  );
});

const formatArb = fc.constantFrom("mp4" as const, "mov" as const);

Deno.test("PBT: sanitizeOutputPath default filename extension matches format", () => {
  fc.assert(
    fc.property(digitIdArb, formatArb, (tweetId, format) => {
      const result = sanitizeOutputPath(undefined, tweetId, format);
      assertEquals(result, `twitter_video_${tweetId}.${format}`);
    }),
  );
});

Deno.test("PBT: sanitizeOutputPath with path always ends with specified format extension", () => {
  fc.assert(
    fc.property(fc.string({ minLength: 1 }), digitIdArb, formatArb, (path, tweetId, format) => {
      const result = sanitizeOutputPath(path, tweetId, format);
      assertEquals(result.endsWith(`.${format}`), true);
    }),
  );
});

Deno.test("PBT: sanitizeOutputPath returns non-empty string", () => {
  fc.assert(
    fc.property(fc.option(fc.string(), { nil: undefined }), digitIdArb, (path, tweetId) => {
      const result = sanitizeOutputPath(path, tweetId);
      assertEquals(result.length > 0, true);
    }),
  );
});
