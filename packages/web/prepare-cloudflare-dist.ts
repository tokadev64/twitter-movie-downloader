import { mkdir, rename, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("./dist/twitter-movie-downloader/", import.meta.url));

await mkdir(appDir, { recursive: true });

const indexPath = fileURLToPath(new URL("./dist/index.html", import.meta.url));
const assetsPath = fileURLToPath(new URL("./dist/assets", import.meta.url));
const targetIndex = fileURLToPath(
  new URL("./dist/twitter-movie-downloader/index.html", import.meta.url),
);
const targetAssets = fileURLToPath(
  new URL("./dist/twitter-movie-downloader/assets", import.meta.url),
);

if (await fileExists(indexPath)) {
  if (await fileExists(targetIndex)) {
    await rm(targetIndex);
  }
  await rename(indexPath, targetIndex);
}

if (await fileExists(assetsPath)) {
  if (await fileExists(targetAssets)) {
    await rm(targetAssets, { recursive: true });
  }
  await rename(assetsPath, targetAssets);
}

console.log("Prepared Cloudflare static assets at dist/twitter-movie-downloader/");

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
