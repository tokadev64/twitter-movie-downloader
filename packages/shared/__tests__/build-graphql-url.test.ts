import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import fc from "npm:fast-check";
import { buildGraphqlUrl } from "../build-graphql-url.ts";
import { GRAPHQL_QUERY_ID } from "../consts.ts";

Deno.test("buildGraphqlUrl: contains GraphQL query ID", () => {
  const url = buildGraphqlUrl("123456789");
  assertStringIncludes(url, GRAPHQL_QUERY_ID);
});

Deno.test("buildGraphqlUrl: contains tweetId in variables", () => {
  const url = buildGraphqlUrl("123456789");
  assertStringIncludes(url, encodeURIComponent('"tweetId":"123456789"'));
});

Deno.test("buildGraphqlUrl: starts with Twitter API base URL", () => {
  const url = buildGraphqlUrl("123456789");
  assertEquals(url.startsWith("https://api.twitter.com/graphql/"), true);
});

Deno.test("buildGraphqlUrl: contains features parameter", () => {
  const url = buildGraphqlUrl("123456789");
  assertStringIncludes(url, "features=");
});

Deno.test("buildGraphqlUrl: is a valid URL", () => {
  const url = buildGraphqlUrl("123456789");
  const parsed = new URL(url);
  assertEquals(parsed.protocol, "https:");
  assertEquals(parsed.hostname, "api.twitter.com");
});

// --- PBT ---

const digitArb = fc.string({
  unit: fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"),
  minLength: 1,
  maxLength: 20,
});

Deno.test("PBT: buildGraphqlUrl always produces valid URL containing tweetId", () => {
  fc.assert(
    fc.property(digitArb, (tweetId) => {
      const url = buildGraphqlUrl(tweetId);
      // 有効な URL であること
      const parsed = new URL(url);
      assertEquals(parsed.protocol, "https:");
      // tweetId が URL に含まれること
      assertStringIncludes(url, encodeURIComponent(`"tweetId":"${tweetId}"`));
      // GraphQL query ID が含まれること
      assertStringIncludes(url, GRAPHQL_QUERY_ID);
    }),
  );
});
