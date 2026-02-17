#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read --allow-run --allow-env

import { TwitterVideoDownloader } from "./downloader.ts";

if (import.meta.main) {
  const args = Deno.args;

  if (args.length < 1) {
    console.log(
      "Usage: deno run --allow-net --allow-write --allow-read --allow-run --allow-env packages/cli/mod.ts <tweet-url> [output-file]",
    );
    console.log(
      "Example: deno run --allow-net --allow-write --allow-read --allow-run --allow-env packages/cli/mod.ts https://x.com/user/status/123456789 video.mp4",
    );
    Deno.exit(1);
  }

  const tweetUrl = args[0];
  const outputFile = args[1];

  const downloader = new TwitterVideoDownloader();
  await downloader.download(tweetUrl, outputFile);
}
