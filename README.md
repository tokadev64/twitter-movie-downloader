# Twitter Video Downloader

X (旧Twitter) から動画をMP4形式でダウンロードするDenoスクリプト

## 機能

- X/Twitterの投稿URLから動画を抽出
- 複数の画質から最高画質を自動選択
- MP4形式で保存
- twitter.com、x.com に対応
- ツイートIDの直接指定に対応

## 使用方法

### 基本的な使い方

```bash
deno run --allow-net --allow-write --allow-read --allow-run --allow-env twitter-movie-downloader.ts <ツイートURL> [出力ファイル名]
```

### 例

```bash
# デフォルトのファイル名で保存
deno run --allow-net --allow-write --allow-read --allow-run --allow-env twitter-movie-downloader.ts https://x.com/user/status/123456789

# カスタムファイル名で保存
deno run --allow-net --allow-write --allow-read --allow-run --allow-env twitter-movie-downloader.ts https://x.com/user/status/123456789 my_video.mp4
```

### 実行権限を付与して使う場合

```bash
# 実行権限を付与
chmod +x twitter-video-downloader.ts

# 直接実行
./twitter-video-downloader.ts https://x.com/user/status/123456789
```

## 必要な権限

- `--allow-net`: ネットワークアクセス（Twitter APIとの通信）
- `--allow-write`: ファイル書き込み（動画の保存）
- `--allow-read`: ファイル読み込み（一時ファイル処理）
- `--allow-run`: 外部コマンド実行（FFmpeg）
- `--allow-env`: 環境変数読み込み（Bearer Token）

## 注意事項

- プライベートアカウントの動画はダウンロードできません
- 一部の動画は権利上の理由でダウンロードできない場合があります
- TwitterのAPI制限により、短時間に大量のダウンロードは避けてください