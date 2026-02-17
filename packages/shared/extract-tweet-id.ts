export function extractTweetId(url: string): string {
  const trimmed = url.trim();

  // 数字のみの場合は直接 tweet ID として扱う
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  const pattern = /(?:mobile\.)?(?:twitter|x)\.com\/\w+\/status\/(\d+)/;
  const match = trimmed.match(pattern);
  if (match) return match[1];

  throw new Error("Invalid Twitter/X URL");
}
