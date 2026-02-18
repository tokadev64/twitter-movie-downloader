import { assertEquals, assertThrows } from "jsr:@std/assert";
import fc from "npm:fast-check";
import { extractTweetId } from "./extract-tweet-id.ts";

Deno.test("extractTweetId: twitter.com URL", () => {
  assertEquals(extractTweetId("https://twitter.com/user/status/123456789"), "123456789");
});

Deno.test("extractTweetId: x.com URL", () => {
  assertEquals(extractTweetId("https://x.com/user/status/987654321"), "987654321");
});

Deno.test("extractTweetId: mobile.twitter.com URL", () => {
  assertEquals(extractTweetId("https://mobile.twitter.com/user/status/111222333"), "111222333");
});

Deno.test("extractTweetId: URL with query parameters", () => {
  assertEquals(extractTweetId("https://x.com/user/status/123456789?s=20&t=abc"), "123456789");
});

Deno.test("extractTweetId: direct tweet ID", () => {
  assertEquals(extractTweetId("123456789"), "123456789");
});

Deno.test("extractTweetId: direct tweet ID with whitespace", () => {
  assertEquals(extractTweetId("  123456789  "), "123456789");
});

Deno.test("extractTweetId: throws on invalid URL", () => {
  assertThrows(() => extractTweetId("https://example.com/invalid"), Error, "Invalid Twitter/X URL");
});

Deno.test("extractTweetId: throws on empty string", () => {
  assertThrows(() => extractTweetId(""), Error, "Invalid Twitter/X URL");
});

Deno.test("extractTweetId: throws on t.co short URL (not supported)", () => {
  assertThrows(() => extractTweetId("https://t.co/abc123"), Error, "Invalid Twitter/X URL");
});

// --- PBT ---

const digitArb = fc.string({
  unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
  minLength: 1,
  maxLength: 20,
});
const usernameArb = fc
  .string({ unit: "grapheme-ascii", minLength: 1, maxLength: 15 })
  .filter((s) => /^\w+$/.test(s));

Deno.test("PBT: extractTweetId round-trip (ID → URL → extract → same ID)", () => {
  fc.assert(
    fc.property(
      digitArb,
      fc.constantFrom("twitter.com", "x.com", "mobile.twitter.com"),
      usernameArb,
      (id, domain, username) => {
        const url = `https://${domain}/${username}/status/${id}`;
        assertEquals(extractTweetId(url), id);
      },
    ),
  );
});

Deno.test("PBT: extractTweetId always returns digit-only string for valid numeric input", () => {
  fc.assert(
    fc.property(digitArb, (id) => {
      const result = extractTweetId(id);
      assertEquals(/^\d+$/.test(result), true);
    }),
  );
});
