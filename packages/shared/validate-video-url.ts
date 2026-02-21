const ALLOWED_VIDEO_HOSTS = ["video.twimg.com", "pbs.twimg.com"];

export function validateVideoUrl(url: string): void {
  if (!url.startsWith("https://")) {
    throw new Error("Invalid video URL: HTTPS required");
  }
}

export function isAllowedVideoHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_VIDEO_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}
