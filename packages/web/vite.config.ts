import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: import.meta.dirname,
  base: "/twitter-movie-downloader/",
  plugins: [vue()],
  server: {
    port: 5173,
  },
});
