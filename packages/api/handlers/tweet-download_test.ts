import { expect, test } from "bun:test";

import { createApp } from "../app.ts";
import { resetGuestTokenCache } from "../twitter-client.ts";

test("GET /api/tweet/:id/download: returns 400 when quality is missing", async () => {
  const app = createApp();
  const res = await app.request("/api/tweet/123456789/download");
  const body = await res.json();
  expect(res.status).toEqual(400);
  expect(body.error.code).toEqual("INVALID_REQUEST");
  expect(body.error.error).toEqual("quality parameter is required");
});

test("GET /api/tweet/:id/download: returns 400 for invalid tweet ID", async () => {
  const app = createApp();
  const res = await app.request("/api/tweet/not-valid/download?quality=2176000");
  const body = await res.json();
  expect(res.status).toEqual(400);
  expect(body.error.code).toEqual("INVALID_REQUEST");
});

test("GET /api/tweet/:id/download: valid params proceed past validation", async () => {
  resetGuestTokenCache();
  const app = createApp();
  // quality + valid ID だが bearer 未取得 → fetch 前に 502 (UPSTREAM_ERROR) になるはず
  const res = await app.request("/api/tweet/123456789/download?quality=2176000", undefined, {
    TWITTER_BEARER_TOKEN: "",
  });
  const body = await res.json();
  expect(res.status).toEqual(502);
  expect(body.error.code).toEqual("UPSTREAM_ERROR");
  expect(body.error.error).toEqual("TWITTER_BEARER_TOKEN environment variable is required");
});
