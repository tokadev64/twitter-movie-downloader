type HookInput = {
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

const raw = await new Response(Deno.stdin.readable).text();
let command = "";
if (raw.trim().length > 0) {
  const input = JSON.parse(raw) as HookInput;
  command = input.command ?? "";
}

if (!isPullRequestCreate(command)) {
  respond({ permission: "allow" });
  Deno.exit(0);
}

let result: Deno.CommandOutput;
try {
  result = await new Deno.Command("deno", {
    args: ["task", "ci:local"],
    stdout: "piped",
    stderr: "piped",
  }).output();
} catch (error) {
  const message = `deno task ci:local を起動できなかったため PR 作成を止めました。\n${
    error instanceof Error ? error.message : String(error)
  }`;
  respond({
    permission: "deny",
    user_message: message,
    agent_message: message,
  });
  Deno.exit(0);
}

if (result.code === 0) {
  respond({ permission: "allow" });
  Deno.exit(0);
}

const output = tail(
  `${new TextDecoder().decode(result.stdout)}\n${new TextDecoder().decode(result.stderr)}`,
);
const message = `deno task ci:local が失敗したため PR 作成を止めました。\n${output}`;
respond({
  permission: "deny",
  user_message: message,
  agent_message: message,
});
