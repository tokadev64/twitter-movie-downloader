import { expect, test } from "bun:test";

import { createApp } from "../app.ts";

test("GET /api/health: returns ok status", async () => {
  const app = createApp();
  const res = await app.request("/api/health");
  const body = await res.json();
  expect(res.status).toEqual(200);
  expect(body.status).toEqual("ok");
});

test("GET /api/tweet/:id: returns 400 for invalid tweet ID", async () => {
  const app = createApp();
  const res = await app.request("/api/tweet/not-a-valid-id");
  const body = await res.json();
  expect(res.status).toEqual(400);
  expect(body.error.code).toEqual("INVALID_REQUEST");
});
