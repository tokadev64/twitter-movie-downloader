import type { Context } from "hono";

export function handleHealth(c: Context): Response {
  const token = Deno.env.get("TWITTER_BEARER_TOKEN");
  return c.json({
    status: "ok",
    tokenSet: token !== undefined,
    tokenLen: token?.length ?? 0,
    envKeys: Object.keys(Deno.env.toObject()).sort(),
  });
}
