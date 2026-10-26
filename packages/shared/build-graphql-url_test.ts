import { expect, test } from "bun:test";

import fc from "fast-check";

import { buildGraphqlUrl } from "./build-graphql-url.ts";
import { GRAPHQL_QUERY_ID } from "./consts.ts";

test("buildGraphqlUrl: contains GraphQL query ID", () => {
  const url = buildGraphqlUrl("123456789");
  expect(url).toContain(GRAPHQL_QUERY_ID);
});

test("buildGraphqlUrl: contains tweetId in variables", () => {
  const url = buildGraphqlUrl("123456789");
  expect(url).toContain(encodeURIComponent('"tweetId":"123456789"'));
});

test("buildGraphqlUrl: starts with Twitter API base URL", () => {
  const url = buildGraphqlUrl("123456789");
  expect(url.startsWith("https://api.twitter.com/graphql/")).toEqual(true);
});

test("buildGraphqlUrl: contains features parameter", () => {
  const url = buildGraphqlUrl("123456789");
  expect(url).toContain("features=");
});

test("buildGraphqlUrl: is a valid URL", () => {
  const url = buildGraphqlUrl("123456789");
  const parsed = new URL(url);
  expect(parsed.protocol).toEqual("https:");
  expect(parsed.hostname).toEqual("api.twitter.com");
});

// --- PBT ---

const digitArb = fc.string({
  unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
  minLength: 1,
  maxLength: 20,
});

test("PBT: buildGraphqlUrl always produces valid URL containing tweetId", () => {
  fc.assert(
    fc.property(digitArb, (tweetId) => {
      const url = buildGraphqlUrl(tweetId);
      // 有効な URL であること
      const parsed = new URL(url);
      expect(parsed.protocol).toEqual("https:");
      // tweetId が URL に含まれること
      expect(url).toContain(encodeURIComponent(`"tweetId":"${tweetId}"`));
      // GraphQL query ID が含まれること
      expect(url).toContain(GRAPHQL_QUERY_ID);
    }),
  );
});
