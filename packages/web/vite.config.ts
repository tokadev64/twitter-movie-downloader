import { defineConfig } from "npm:vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/twitter-movie-downloader/",
  plugins: [vue()],
  server: {
    port: 5173,
  },
});
