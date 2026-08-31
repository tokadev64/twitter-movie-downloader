const distDir = new URL("./dist/", import.meta.url);
const appDir = new URL("./dist/twitter-movie-downloader/", import.meta.url);

await Deno.mkdir(appDir, { recursive: true });

const indexPath = new URL("./dist/index.html", import.meta.url);
const assetsPath = new URL("./dist/assets", import.meta.url);
const targetIndex = new URL("./dist/twitter-movie-downloader/index.html", import.meta.url);
const targetAssets = new URL("./dist/twitter-movie-downloader/assets", import.meta.url);

if (await fileExists(indexPath)) {
  if (await fileExists(targetIndex)) {
    await Deno.remove(targetIndex);
  }
  await Deno.rename(indexPath, targetIndex);
}

if (await fileExists(assetsPath)) {
  if (await fileExists(targetAssets)) {
    await Deno.remove(targetAssets, { recursive: true });
  }
  await Deno.rename(assetsPath, targetAssets);
}

console.log("Prepared Cloudflare static assets at dist/twitter-movie-downloader/");

async function fileExists(path: URL): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
