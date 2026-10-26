#!/usr/bin/env bun

import { TwitterVideoDownloader } from "./downloader.ts";

function parseArgs(args: string[]): { tweetUrl: string; outputFile?: string } {
  if (args.length < 1) {
    console.log("Usage: bun run tw <tweet-url> [output-file]");
    console.log("Example: bun run tw https://x.com/user/status/123456789 video.mp4");
    process.exit(1);
  }

  return { tweetUrl: args[0], outputFile: args[1] };
}

if (import.meta.main) {
  const { tweetUrl, outputFile } = parseArgs(process.argv.slice(2));

  const downloader = new TwitterVideoDownloader();
  await downloader.download(tweetUrl, outputFile);
}
