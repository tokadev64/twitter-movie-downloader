import vue from "@vitejs/plugin-vue";

export default {
  base: "/twitter-movie-downloader/",
  plugins: [vue()],
  server: {
    port: 5173,
  },
};
