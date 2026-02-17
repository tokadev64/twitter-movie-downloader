import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleHealth } from "./handlers/health.ts";
import { handleTweetInfo } from "./handlers/tweet-info.ts";

const app = new Hono();

app.use("*", cors());

app.get("/api/health", handleHealth);
app.get("/api/tweet/:id", handleTweetInfo);

Deno.serve({ port: 8000 }, app.fetch);
