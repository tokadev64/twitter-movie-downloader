#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read --allow-run --allow-env

import { TwitterVideoDownloader } from "./downloader.ts";

function parseArgs(args: string[]): { tweetUrl: string; outputFile?: string } {
  if (args.length < 1) {
    console.log("Usage: deno task tw <tweet-url> [output-file]");
    console.log("Example: deno task tw https://x.com/user/status/123456789 video.mp4");
    Deno.exit(1);
  }

  return { tweetUrl: args[0], outputFile: args[1] };
}

if (import.meta.main) {
  const { tweetUrl, outputFile } = parseArgs(Deno.args);

  const downloader = new TwitterVideoDownloader();
  await downloader.download(tweetUrl, outputFile);
}
