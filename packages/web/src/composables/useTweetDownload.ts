import type { MediaInfo, TweetInfoResponse } from "@tmd/shared";
import { ref } from "vue";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function useTweetDownload() {
  const mediaList = ref<MediaInfo[]>([]);
  const tweetId = ref("");
  const isLoading = ref(false);
  const errorMessage = ref("");

  async function fetchTweetInfo(url: string): Promise<void> {
    isLoading.value = true;
    errorMessage.value = "";
    mediaList.value = [];

    try {
      // URL から tweet ID を抽出（簡易版: API 側で extractTweetId を実行する）
      const idOrUrl = url.trim();
      const response = await fetch(`${API_BASE_URL}/api/tweet/${encodeURIComponent(idOrUrl)}`);

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error?.error || `Request failed: ${response.status}`);
      }

      const data: TweetInfoResponse = body.data;
      tweetId.value = data.tweetId;
      mediaList.value = data.mediaList;

      if (data.mediaList.length === 0) {
        errorMessage.value = "No videos found in the tweet";
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Unknown error occurred";
    } finally {
      isLoading.value = false;
    }
  }

  function reset(): void {
    mediaList.value = [];
    tweetId.value = "";
    errorMessage.value = "";
  }

  return {
    mediaList,
    tweetId,
    isLoading,
    errorMessage,
    fetchTweetInfo,
    reset,
  };
}
