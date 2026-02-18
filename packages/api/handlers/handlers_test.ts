import { assertEquals } from "jsr:@std/assert";
import { Hono } from "hono";
import { handleHealth } from "./health.ts";
import { handleTweetInfo } from "./tweet-info.ts";

function createApp(): Hono {
  const app = new Hono();
  app.get("/api/health", handleHealth);
  app.get("/api/tweet/:id", handleTweetInfo);
  return app;
}

Deno.test("GET /api/health: returns ok status", async () => {
  const app = createApp();
  const res = await app.request("/api/health");
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.status, "ok");
});

Deno.test("GET /api/tweet/:id: returns 400 for invalid tweet ID", async () => {
  const app = createApp();
  const res = await app.request("/api/tweet/not-a-valid-id");
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error.code, "INVALID_REQUEST");
});
