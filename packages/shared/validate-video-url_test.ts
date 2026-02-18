import { assertThrows } from "jsr:@std/assert";
import fc from "npm:fast-check";
import { validateVideoUrl } from "./validate-video-url.ts";

Deno.test("validateVideoUrl: accepts valid HTTPS URL", () => {
  validateVideoUrl("https://video.twimg.com/ext_tw_video/123/pu/vid/720x1280/abc.mp4");
});

Deno.test("validateVideoUrl: throws on HTTP URL", () => {
  assertThrows(
    () => validateVideoUrl("http://video.twimg.com/video.mp4"),
    Error,
    "Invalid video URL: HTTPS required",
  );
});

Deno.test("validateVideoUrl: throws on empty string", () => {
  assertThrows(() => validateVideoUrl(""), Error, "Invalid video URL: HTTPS required");
});

Deno.test("validateVideoUrl: throws on relative path", () => {
  assertThrows(
    () => validateVideoUrl("/path/to/video.mp4"),
    Error,
    "Invalid video URL: HTTPS required",
  );
});

// --- PBT ---

Deno.test("PBT: validateVideoUrl always throws for non-HTTPS URLs", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("http://", "ftp://", "ws://", "file://", "data:", ""),
      fc.webUrl().map((url) => new URL(url).pathname),
      (scheme, path) => {
        const url = `${scheme}${path}`;
        if (!url.startsWith("https://")) {
          assertThrows(() => validateVideoUrl(url), Error, "HTTPS required");
        }
      },
    ),
  );
});
