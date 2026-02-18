import type { VideoFormat } from "./types.ts";

const SUPPORTED_FORMATS: ReadonlySet<string> = new Set(["mp4", "mov"]);

export function validateFormat(input: string): VideoFormat {
  if (!SUPPORTED_FORMATS.has(input)) {
    throw new Error(`Invalid format: "${input}". Supported formats: mp4, mov`);
  }
  return input as VideoFormat;
}
