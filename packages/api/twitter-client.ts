import type { MediaInfo } from "@tmd/shared";
import { buildGraphqlUrl, extractMediaInfo } from "@tmd/shared";

const GUEST_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface GuestTokenCache {
  token: string;
  expiresAt: number;
}

let guestTokenCache: GuestTokenCache | null = null;

function getBearerToken(): string {
  const token = Deno.env.get("TWITTER_BEARER_TOKEN");
  if (!token) {
    throw new Error("TWITTER_BEARER_TOKEN environment variable is required");
  }
  return token;
}

async function getGuestToken(): Promise<string> {
  const now = Date.now();
  if (guestTokenCache && guestTokenCache.expiresAt > now) {
    return guestTokenCache.token;
  }

  const response = await fetch("https://api.twitter.com/1.1/guest/activate.json", {
    method: "POST",
    headers: {
      Authorization: getBearerToken(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get guest token: ${response.status}`);
  }

  const data = await response.json();
  guestTokenCache = {
    token: data.guest_token,
    expiresAt: now + GUEST_TOKEN_TTL_MS,
  };

  return guestTokenCache.token;
}

export async function fetchTweetMedia(tweetId: string): Promise<MediaInfo[]> {
  const guestToken = await getGuestToken();
  const url = buildGraphqlUrl(tweetId);

  const response = await fetch(url, {
    headers: {
      Authorization: getBearerToken(),
      "x-guest-token": guestToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tweet data: ${response.status}`);
  }

  const tweetData = await response.json();
  return extractMediaInfo(tweetData);
}

/** テスト用: Guest Token キャッシュをリセット */
export function resetGuestTokenCache(): void {
  guestTokenCache = null;
}
