import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const supportDir = import.meta.dir;
const e2eDir = resolve(supportDir, "..");
const repoRoot = resolve(e2eDir, "..");
const cliEntryPath = join(repoRoot, "packages", "cli", "mod.ts");
const preloadPath = join(supportDir, "cli-fetch-preload.ts");
const fakeFfmpegDir = join(supportDir, "fake-ffmpeg");
const bunPath = process.execPath;

export interface CliRunOptions {
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  fakeFfmpeg?: boolean;
  emptyPath?: boolean;
}

export interface CliRunResult {
  code: number;
  stdout: string;
  stderr: string;
  // oxlint-disable-next-line typescript/no-explicit-any -- fetch log fixture is dynamically shaped
  fetchLog: any[];
  ffmpegArgs: string[][];
  ffmpegLogPath: string;
  fetchLogPath: string;
}

export function makeTempDir(prefix = "tmd-e2e-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function readJsonl(path: string): unknown[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function runCli(options: CliRunOptions): Promise<CliRunResult> {
  const ffmpegLogPath = join(options.cwd, "ffmpeg.log");
  const fetchLogPath = join(options.cwd, "fetch-log.jsonl");
  const bunDir = dirname(bunPath);
  const path = options.emptyPath
    ? options.cwd
    : [fakeFfmpegDir, bunDir, "/usr/local/bin", "/usr/bin", "/bin"].join(":");

  // oxlint-disable-next-line typescript/no-explicit-any -- fetch log fixture is dynamically shaped
  const fetchLog: any[] = [];
  const ffmpegArgs: string[][] = [];

  const env: Record<string, string> = {
    PATH: path,
    PWD: options.cwd,
    HOME: options.cwd,
    LANG: "C",
    LC_ALL: "C",
    E2E_FFMPEG_LOG: ffmpegLogPath,
    E2E_CLI_FETCH_LOG: fetchLogPath,
    ...options.env,
  };

  const proc = Bun.spawn([bunPath, "--preload", preloadPath, cliEntryPath, ...options.args], {
    cwd: options.cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;

  if (existsSync(fetchLogPath)) {
    fetchLog.push(...(readJsonl(fetchLogPath) as never[]));
  }
  if (existsSync(ffmpegLogPath)) {
    ffmpegArgs.push(...(readJsonl(ffmpegLogPath) as never[]));
  }

  return { code, stdout, stderr, fetchLog, ffmpegArgs, ffmpegLogPath, fetchLogPath };
}
