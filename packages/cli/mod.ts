#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read --allow-run --allow-env

import type { VideoFormat } from "@tmd/shared";
import { validateFormat } from "@tmd/shared";
import { TwitterVideoDownloader } from "./downloader.ts";

function parseArgs(args: string[]): { tweetUrl: string; outputFile?: string; format: VideoFormat } {
  let format: VideoFormat = "mp4";
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && i + 1 < args.length) {
      format = validateFormat(args[i + 1]);
      i++;
    } else {
      positional.push(args[i]);
    }
  }

  if (positional.length < 1) {
    console.log("Usage: deno task tw <tweet-url> [output-file] [--format mp4|mov]");
    console.log("Example: deno task tw https://x.com/user/status/123456789 video.mp4 --format mov");
    Deno.exit(1);
  }

  return { tweetUrl: positional[0], outputFile: positional[1], format };
}

if (import.meta.main) {
  const { tweetUrl, outputFile, format } = parseArgs(Deno.args);

  const downloader = new TwitterVideoDownloader();
  await downloader.download(tweetUrl, outputFile, format);
}
