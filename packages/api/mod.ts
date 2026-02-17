import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleHealth } from "./handlers/health.ts";
import { handleTweetDownload } from "./handlers/tweet-download.ts";
import { handleTweetInfo } from "./handlers/tweet-info.ts";

const app = new Hono();

app.use("*", cors());

app.get("/api/health", handleHealth);
app.get("/api/tweet/:id", handleTweetInfo);
app.get("/api/tweet/:id/download", handleTweetDownload);

Deno.serve({ port: 8000 }, app.fetch);
