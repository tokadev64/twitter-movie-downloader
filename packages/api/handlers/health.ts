import type { Context } from "hono";

export function handleHealth(c: Context): Response {
  const token = Deno.env.get("TWITTER_BEARER_TOKEN");
  return c.json({
    status: "ok",
    debug: {
      tokenExists: token !== undefined,
      tokenLength: token?.length ?? 0,
      tokenPrefix: token?.substring(0, 10) ?? "UNDEFINED",
      envKeyCount: Object.keys(Deno.env.toObject()).length,
      envKeys: Object.keys(Deno.env.toObject()).sort(),
    },
  });
}
