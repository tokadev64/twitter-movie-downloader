# PR Change Summary: 動画メタデータ表示の UI 改善

## 1. 型定義の拡張

**目的**: 動画メタデータを MediaInfo 型で表現できるようにする

- `/Users/t.okada/work/twitter-movie-downloader/packages/shared/types.ts`: `MediaInfo` に 7 つの optional フィールド追加（width, height, aspectRatio, durationMs, videoCodec, audioCodec, fileSizeBytes）

## 2. URL パース・メタデータ抽出ロジック

**目的**: Twitter 動画 URL から解像度・コーデック情報を抽出し、video_info から共通メタデータを取得

- `/Users/t.okada/work/twitter-movie-downloader/packages/shared/extract-media-info.ts`:
  - `parseVideoUrlMetadata()` 追加 — `/vid/avc1/1280x720/` パターンから width, height, videoCodec を抽出
  - `extractMediaInfo()` 拡張 — aspectRatio, durationMs, audioCodec を各バリアントに付加
- `/Users/t.okada/work/twitter-movie-downloader/packages/shared/mod.ts`: `parseVideoUrlMetadata`, `isAllowedVideoHost` エクスポート追加

## 3. セキュリティ強化（SSRF 防止 + NaN ガード）

**目的**: 外部 URL への fetch にドメインバリデーションを追加

- `/Users/t.okada/work/twitter-movie-downloader/packages/shared/validate-video-url.ts`: `isAllowedVideoHost()` 追加（allowlist: video.twimg.com, pbs.twimg.com）
- `/Users/t.okada/work/twitter-movie-downloader/packages/api/handlers/tweet-info.ts`:
  - `enrichWithFileSize()` 追加 — 並列 HEAD リクエストで Content-Length 取得
  - `isAllowedVideoHost()` でドメイン検証、`Number.isFinite()` で NaN ガード

## 4. フロントエンド UI 刷新

**目的**: サムネイル・解像度・コーデック・ファイルサイズの視覚的表示

- `/Users/t.okada/work/twitter-movie-downloader/packages/web/src/components/VideoResultList.vue`:
  - サムネイル画像表示（全バリアント共通 1 枚）+ 再生時間バッジ
  - メタデータ行: 解像度・アスペクト比・コーデック・ファイルサイズ
  - ダウンロードボタンをインライン SVG アイコンに変更

## 5. テスト拡充

**目的**: 新規ロジックのカバレッジ確保

- `/Users/t.okada/work/twitter-movie-downloader/packages/shared/extract-media-info_test.ts`: parseVideoUrlMetadata 5 テスト追加、既存テストに新フィールド assertion 追加、フォールバックテスト追加（計 16 テスト）
- `/Users/t.okada/work/twitter-movie-downloader/packages/shared/validate-video-url_test.ts`: isAllowedVideoHost 4 テスト追加（計 9 テスト）
