import type { ApiErrorResponse, VideoFormat } from "@tmd/shared";
import { extractTweetId, validateFormat } from "@tmd/shared";
import type { Context } from "hono";
import { fetchTweetMedia } from "../twitter-client.ts";

async function streamMp4Proxy(videoUrl: string): Promise<Response> {
  const upstream = await fetch(videoUrl);
  if (!upstream.ok) {
    throw new Error(`Failed to fetch video: ${upstream.status}`);
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "video/mp4",
    },
  });
}

async function convertToMov(videoUrl: string): Promise<Response> {
  const tempDir = await Deno.makeTempDir();
  const tempMp4 = `${tempDir}/input.mp4`;
  const tempMov = `${tempDir}/output.mov`;

  try {
    const upstream = await fetch(videoUrl);
    if (!upstream.ok) {
      throw new Error(`Failed to fetch video: ${upstream.status}`);
    }
    const data = await upstream.arrayBuffer();
    await Deno.writeFile(tempMp4, new Uint8Array(data));

    const cmd = new Deno.Command("ffmpeg", {
      args: ["-i", tempMp4, "-c", "copy", "-f", "mov", "-y", tempMov],
      stdout: "piped",
      stderr: "piped",
    });
    const { success } = await cmd.output();

    if (!success) {
      throw new Error("FFmpeg remux to MOV failed");
    }

    const movData = await Deno.readFile(tempMov);
    return new Response(movData, {
      headers: {
        "Content-Type": "video/quicktime",
      },
    });
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

async function convertHls(hlsUrl: string, format: VideoFormat): Promise<Response> {
  const tempDir = await Deno.makeTempDir();
  const outputExt = format === "mov" ? "mov" : "mp4";
  const outputFile = `${tempDir}/output.${outputExt}`;
  const formatFlag = format === "mov" ? "mov" : "mp4";

  try {
    const cmd = new Deno.Command("ffmpeg", {
      args: ["-i", hlsUrl, "-c", "copy", "-f", formatFlag, "-y", outputFile],
      stdout: "piped",
      stderr: "piped",
    });
    const { success } = await cmd.output();

    if (!success) {
      throw new Error("FFmpeg HLS conversion failed");
    }

    const data = await Deno.readFile(outputFile);
    const contentType = format === "mov" ? "video/quicktime" : "video/mp4";
    return new Response(data, {
      headers: {
        "Content-Type": contentType,
      },
    });
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
}

export async function handleTweetDownload(c: Context): Promise<Response> {
  try {
    const tweetId = c.req.param("id");
    const quality = c.req.query("quality");
    const formatParam = c.req.query("format") ?? "mp4";

    if (!quality) {
      const body: { data: null; error: ApiErrorResponse } = {
        data: null,
        error: { error: "quality parameter is required", code: "INVALID_REQUEST" },
      };
      return c.json(body, 400);
    }

    let format: VideoFormat;
    try {
      format = validateFormat(formatParam);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid format";
      const body: { data: null; error: ApiErrorResponse } = {
        data: null,
        error: { error: message, code: "INVALID_REQUEST" },
      };
      return c.json(body, 400);
    }

    const validatedId = extractTweetId(tweetId);
    const mediaList = await fetchTweetMedia(validatedId);

    const media = mediaList.find((m) => m.quality === quality);
    if (!media) {
      const body: { data: null; error: ApiErrorResponse } = {
        data: null,
        error: { error: `No video found with quality: ${quality}`, code: "NOT_FOUND" },
      };
      return c.json(body, 404);
    }

    const filename = `twitter_video_${validatedId}.${format}`;
    let response: Response;

    if (media.quality === "HLS") {
      response = await convertHls(media.videoUrl, format);
    } else if (format === "mov") {
      response = await convertToMov(media.videoUrl);
    } else {
      response = await streamMp4Proxy(media.videoUrl);
    }

    response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Invalid") ? 400 : 502;
    const code = status === 400 ? "INVALID_REQUEST" : "UPSTREAM_ERROR";

    const body: { data: null; error: ApiErrorResponse } = {
      data: null,
      error: { error: message, code },
    };
    return c.json(body, status);
  }
}
