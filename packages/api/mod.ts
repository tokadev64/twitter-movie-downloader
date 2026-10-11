import { createApp } from "./app.ts";

const app = createApp();

Bun.serve({
  port: 8000,
  fetch: app.fetch,
});
