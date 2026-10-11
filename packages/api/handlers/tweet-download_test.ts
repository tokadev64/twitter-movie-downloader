import { expect, test } from "bun:test";

import { createApp } from "../app.ts";

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
  const app = createApp();
  // quality + valid ID だが twitter API は利用不可 → 502 (UPSTREAM_ERROR) になるはず
  const res = await app.request("/api/tweet/123456789/download?quality=2176000");
  expect(res.status !== 400).toEqual(true);
});
