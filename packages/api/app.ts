import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ApiEnv } from "./env.ts";
import { handleHealth } from "./handlers/health.ts";
import { handleTweetDownload } from "./handlers/tweet-download.ts";
import { handleTweetInfo } from "./handlers/tweet-info.ts";

export function createApp(): Hono<{ Bindings: ApiEnv }> {
  const app = new Hono<{ Bindings: ApiEnv }>();

  app.use("*", cors());

  app.get("/api/health", handleHealth);
  app.get("/api/tweet/:id", handleTweetInfo);
  app.get("/api/tweet/:id/download", handleTweetDownload);

  return app;
}
