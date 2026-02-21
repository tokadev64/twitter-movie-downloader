import type { Context } from "hono";

export function handleHealth(c: Context): Response {
  const token = Deno.env.get("TWITTER_BEARER_TOKEN");
  const envKeys = [...Deno.env.toObject()].map(([k]) => k).sort();
  return c.json({
    status: "ok",
    debug: {
      tokenExists: typeof token === "string",
      tokenLength: token?.length ?? 0,
      tokenPrefix: token?.substring(0, 10) ?? "UNDEFINED",
      allEnvKeys: envKeys,
    },
  });
}
