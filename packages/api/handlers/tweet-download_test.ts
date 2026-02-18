import { assertEquals } from "jsr:@std/assert";
import { Hono } from "hono";
import { handleTweetDownload } from "./tweet-download.ts";

function createApp(): Hono {
  const app = new Hono();
  app.get("/api/tweet/:id/download", handleTweetDownload);
  return app;
}

// --- バリデーションテスト ---

Deno.test("GET /api/tweet/:id/download: returns 400 when quality is missing", async () => {
  const app = createApp();
  const res = await app.request("/api/tweet/123456789/download");
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error.code, "INVALID_REQUEST");
  assertEquals(body.error.error, "quality parameter is required");
});

Deno.test("GET /api/tweet/:id/download: returns 400 for invalid tweet ID", async () => {
  const app = createApp();
  const res = await app.request("/api/tweet/not-valid/download?quality=2176000");
  const body = await res.json();
  assertEquals(res.status, 400);
  assertEquals(body.error.code, "INVALID_REQUEST");
});

Deno.test("GET /api/tweet/:id/download: valid params proceed past validation", async () => {
  const app = createApp();
  // quality + valid ID だが twitter API は利用不可 → 502 (UPSTREAM_ERROR) になるはず
  const res = await app.request("/api/tweet/123456789/download?quality=2176000");
  assertEquals(res.status !== 400, true);
});
