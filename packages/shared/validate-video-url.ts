export function validateVideoUrl(url: string): void {
  if (!url.startsWith("https://")) {
    throw new Error("Invalid video URL: HTTPS required");
  }
}
