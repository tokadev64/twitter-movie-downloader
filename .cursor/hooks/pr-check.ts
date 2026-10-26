export type HookInput = {
  command?: string;
};

const MAX_MESSAGE_CHARS = 4000;

function respond(body: Record<string, string>): void {
  console.log(JSON.stringify(body));
}

function isPullRequestCreate(command: string): boolean {
  return /\bgh\s+pr\s+create\b/.test(command);
}

function tail(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_MESSAGE_CHARS) return trimmed;
  return trimmed.slice(trimmed.length - MAX_MESSAGE_CHARS);
}

const raw = await Bun.stdin.text();
let command = "";
if (raw.trim().length > 0) {
  const input = JSON.parse(raw) as HookInput;
  command = input.command ?? "";
}

if (!isPullRequestCreate(command)) {
  respond({ permission: "allow" });
  process.exit(0);
}

let code: number;
let output = "";
try {
  const proc = Bun.spawn(["bun", "run", "ci:local"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  code = exitCode;
  output = `${stdout}\n${stderr}`;
} catch (error) {
  const message = `bun run ci:local を起動できなかったため PR 作成を止めました。\n${
    error instanceof Error ? error.message : String(error)
  }`;
  respond({
    permission: "deny",
    user_message: message,
    agent_message: message,
  });
  process.exit(0);
}

if (code === 0) {
  respond({ permission: "allow" });
  process.exit(0);
}

const message = `bun run ci:local が失敗したため PR 作成を止めました。\n${tail(output)}`;
respond({
  permission: "deny",
  user_message: message,
  agent_message: message,
});
