import { expect, test } from "bun:test";

import fc from "fast-check";

import { extractTweetId } from "./extract-tweet-id.ts";

test("extractTweetId: twitter.com URL", () => {
  expect(extractTweetId("https://twitter.com/user/status/123456789")).toEqual("123456789");
});

test("extractTweetId: x.com URL", () => {
  expect(extractTweetId("https://x.com/user/status/987654321")).toEqual("987654321");
});

test("extractTweetId: mobile.twitter.com URL", () => {
  expect(extractTweetId("https://mobile.twitter.com/user/status/111222333")).toEqual("111222333");
});

test("extractTweetId: URL with query parameters", () => {
  expect(extractTweetId("https://x.com/user/status/123456789?s=20&t=abc")).toEqual("123456789");
});

test("extractTweetId: direct tweet ID", () => {
  expect(extractTweetId("123456789")).toEqual("123456789");
});

test("extractTweetId: direct tweet ID with whitespace", () => {
  expect(extractTweetId("  123456789  ")).toEqual("123456789");
});

test("extractTweetId: throws on invalid URL", () => {
  expect(() => extractTweetId("https://example.com/invalid")).toThrow("Invalid Twitter/X URL");
});

test("extractTweetId: throws on empty string", () => {
  expect(() => extractTweetId("")).toThrow("Invalid Twitter/X URL");
});

test("extractTweetId: throws on t.co short URL (not supported)", () => {
  expect(() => extractTweetId("https://t.co/abc123")).toThrow("Invalid Twitter/X URL");
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

test("PBT: extractTweetId round-trip (ID → URL → extract → same ID)", () => {
  fc.assert(
    fc.property(
      digitArb,
      fc.constantFrom("twitter.com", "x.com", "mobile.twitter.com"),
      usernameArb,
      (id, domain, username) => {
        const url = `https://${domain}/${username}/status/${id}`;
        expect(extractTweetId(url)).toEqual(id);
      },
    ),
  );
});

test("PBT: extractTweetId always returns digit-only string for valid numeric input", () => {
  fc.assert(
    fc.property(digitArb, (id) => {
      const result = extractTweetId(id);
      expect(/^\d+$/.test(result)).toEqual(true);
    }),
  );
});
