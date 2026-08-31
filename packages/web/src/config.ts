/** 本番は同一オリジンの /api を使う。開発時のみローカル API に接続する。 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:8000" : "");
