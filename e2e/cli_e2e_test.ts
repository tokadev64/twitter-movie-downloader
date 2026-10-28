import { expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_BEARER_TOKEN } from "../packages/cli/downloader.ts";
import { makeTempDir, runCli } from "./support/cli-runner.ts";
import {
  HIGH_MP4_URL,
  HLS_URL,
  LOW_MP4_URL,
  TWEET_ID,
  makeTweetDataWithVariants,
  makeVideoVariant,
} from "./support/fixtures.ts";

const VALID_TWEET_URL = `https://x.com/user/status/${TWEET_ID}`;
const HLS_TWEET_DATA = makeTweetDataWithVariants([
  makeVideoVariant(HLS_URL, "application/x-mpegURL"),
  makeVideoVariant(LOW_MP4_URL, "video/mp4", 832000),
  makeVideoVariant(HIGH_MP4_URL, "video/mp4", 2176000),
]);
const MP4_TWEET_DATA = makeTweetDataWithVariants([
  makeVideoVariant(LOW_MP4_URL, "video/mp4", 832000),
  makeVideoVariant(HIGH_MP4_URL, "video/mp4", 2176000),
]);

function fixtureEnv(
  tweetData: unknown,
  extra: Record<string, string> = {},
): Record<string, string> {
  return { E2E_CLI_TWEET_DATA: JSON.stringify(tweetData), ...extra };
}

test("CLI-BEARER-ENV: TWITTER_BEARER_TOKEN overrides the bundled default bearer", async () => {
  const cwd = makeTempDir();
  try {
    const run = await runCli({
      args: [VALID_TWEET_URL, "out.mp4"],
      cwd,
      env: fixtureEnv(HLS_TWEET_DATA, { TWITTER_BEARER_TOKEN: "Bearer e2e-cli" }),
    });

    expect(run.code).toEqual(0);
    expect(run.stderr).toEqual("");
    expect(run.fetchLog[0]?.authorization).toEqual("Bearer e2e-cli");
    expect(run.fetchLog[1]?.authorization).toEqual("Bearer e2e-cli");
    expect(run.fetchLog[1]?.guestToken).toEqual("e2e-guest-token");
    expect(existsSync(join(cwd, "out.mp4"))).toEqual(true);
    expect(readFileSync(join(cwd, "out.mp4"), "utf8")).toEqual("fake-video-bytes");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CLI-BEARER-DEFAULT: no bearer env uses DEFAULT_BEARER_TOKEN", async () => {
  const cwd = makeTempDir();
  try {
    const run = await runCli({
      args: [VALID_TWEET_URL, "out.mp4"],
      cwd,
      env: fixtureEnv(HLS_TWEET_DATA),
    });

    expect(run.code).toEqual(0);
    expect(run.fetchLog[0]?.authorization).toEqual(DEFAULT_BEARER_TOKEN);
    expect(run.fetchLog[1]?.authorization).toEqual(DEFAULT_BEARER_TOKEN);
    expect(existsSync(join(cwd, "out.mp4"))).toEqual(true);
    expect(readFileSync(join(cwd, "out.mp4"), "utf8")).toEqual("fake-video-bytes");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CLI-HLS-PREFERRED: HLS is used when present and no mp4 media URL is fetched", async () => {
  const cwd = makeTempDir();
  try {
    const run = await runCli({
      args: [VALID_TWEET_URL, "out.mp4"],
      cwd,
      env: fixtureEnv(HLS_TWEET_DATA),
    });

    expect(run.code).toEqual(0);
    expect(run.stderr).toEqual("");
    expect(run.fetchLog.length).toEqual(2);
    expect(run.fetchLog[0]?.url).toEqual("https://api.twitter.com/1.1/guest/activate.json");
    expect(run.fetchLog[1]?.url).toContain("TweetResultByRestId");
    expect(run.fetchLog.some((entry: { url: string }) => entry.url === HIGH_MP4_URL)).toEqual(
      false,
    );
    expect(run.fetchLog.some((entry: { url: string }) => entry.url === LOW_MP4_URL)).toEqual(false);

    expect(run.ffmpegArgs[1]?.[1]).toEqual(HLS_URL);
    expect(run.ffmpegArgs[1]?.at(-1)).toEqual("out.mp4.temp.mp4");
    expect(existsSync(join(cwd, "out.mp4"))).toEqual(true);
    expect(readFileSync(join(cwd, "out.mp4"), "utf8")).toEqual("fake-video-bytes");
    expect(existsSync(join(cwd, "out.mp4.temp.mp4"))).toEqual(false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CLI-MP4-HIGHEST-BITRATE: without HLS the selected mp4 is the first media entry with the highest bitrate", async () => {
  const cwd = makeTempDir();
  try {
    const run = await runCli({
      args: [VALID_TWEET_URL, "out.mp4"],
      cwd,
      env: fixtureEnv(MP4_TWEET_DATA),
    });

    expect(run.code).toEqual(0);
    expect(run.stderr).toEqual("");
    expect(run.fetchLog.length).toEqual(3);
    expect(run.fetchLog[2]?.method).toEqual("GET");
    expect(run.fetchLog[2]?.url).toEqual(HIGH_MP4_URL);

    expect(run.ffmpegArgs[1]?.[1]).toEqual("out.mp4.temp");
    expect(run.ffmpegArgs[1]?.at(-1)).toEqual("out.mp4");
    expect(existsSync(join(cwd, "out.mp4"))).toEqual(true);
    expect(readFileSync(join(cwd, "out.mp4"), "utf8")).toEqual("fake-video-bytes");
    expect(existsSync(join(cwd, "out.mp4.temp"))).toEqual(false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CLI-OUTNAME: path traversal is flattened and only the final extension is replaced", async () => {
  const cwd = makeTempDir();
  try {
    const run = await runCli({
      args: [VALID_TWEET_URL, "../../weird/vid.tar.gz"],
      cwd,
      env: fixtureEnv(HLS_TWEET_DATA),
    });

    expect(run.code).toEqual(0);
    expect(existsSync(join(cwd, "vid.tar.mp4"))).toEqual(true);
    expect(readFileSync(join(cwd, "vid.tar.mp4"), "utf8")).toEqual("fake-video-bytes");
    expect(existsSync(join(cwd, "vid.tar.mp4.temp.mp4"))).toEqual(false);
    expect(existsSync(join(cwd, "weird"))).toEqual(false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CLI-NO-FFMPEG: missing ffmpeg exits before tweet ID extraction or fetch", async () => {
  const cwd = makeTempDir();
  try {
    const run = await runCli({
      args: [VALID_TWEET_URL, "out.mp4"],
      cwd,
      emptyPath: true,
      env: fixtureEnv(HLS_TWEET_DATA),
    });

    expect(run.code).toEqual(1);
    expect(run.stderr).toContain("Error: FFmpeg is not installed. Please install FFmpeg first.");
    expect(run.stderr).toContain("Ubuntu/Debian: sudo apt-get install ffmpeg");
    expect(run.fetchLog.length).toEqual(0);
    expect(existsSync(join(cwd, "out.mp4"))).toEqual(false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CLI-BAD-URL: invalid tweet URL exits before guest or graphql fetch", async () => {
  const cwd = makeTempDir();
  try {
    const run = await runCli({
      args: ["https://evil.example/not-a-tweet", "out.mp4"],
      cwd,
      env: fixtureEnv(HLS_TWEET_DATA),
    });

    expect(run.code).toEqual(1);
    expect(run.stderr).toContain("Error: Invalid Twitter/X URL");
    expect(run.fetchLog.length).toEqual(0);
    expect(existsSync(join(cwd, "out.mp4"))).toEqual(false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CLI-TORN-MP4: ffmpeg failure leaves the final output and removes the temp file", async () => {
  const cwd = makeTempDir();
  try {
    const run = await runCli({
      args: [VALID_TWEET_URL, "out.mp4"],
      cwd,
      env: fixtureEnv(MP4_TWEET_DATA, { E2E_FAKE_FFMPEG_FAIL: "1" }),
    });

    expect(run.code).toEqual(1);
    expect(run.stderr).toContain("Error: FFmpeg failed to re-encode video");
    expect(existsSync(join(cwd, "out.mp4"))).toEqual(true);
    expect(readFileSync(join(cwd, "out.mp4"), "utf8")).toEqual("partial-video-bytes");
    expect(existsSync(join(cwd, "out.mp4.temp"))).toEqual(false);
    expect(run.fetchLog.length).toEqual(3);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CLI-TORN-HLS: ffmpeg failure leaves the temp partial file and does not create the final output", async () => {
  const cwd = makeTempDir();
  try {
    const run = await runCli({
      args: [VALID_TWEET_URL, "out.mp4"],
      cwd,
      env: fixtureEnv(HLS_TWEET_DATA, { E2E_FAKE_FFMPEG_FAIL: "1" }),
    });

    expect(run.code).toEqual(1);
    expect(run.stderr).toContain("Error: FFmpeg failed to download HLS stream");
    expect(existsSync(join(cwd, "out.mp4.temp.mp4"))).toEqual(true);
    expect(readFileSync(join(cwd, "out.mp4.temp.mp4"), "utf8")).toEqual("partial-video-bytes");
    expect(existsSync(join(cwd, "out.mp4"))).toEqual(false);
    expect(run.fetchLog.length).toEqual(2);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
