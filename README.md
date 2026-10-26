# Twitter Video Downloader

X (旧Twitter) から動画を MP4 形式でダウンロードする Bun スクリプト。

## 機能

- X/Twitter の投稿 URL から動画を抽出
- 複数の画質から最高画質を自動選択
- MP4 形式で保存
- twitter.com、x.com に対応
- ツイート ID の直接指定に対応

## 使用方法

依存関係を入れてから、ツイート URL を渡す。

```bash
bun install
bun run tw <ツイートURL> [出力ファイル名]
```

### 例

```bash
# デフォルトのファイル名で保存
bun run tw https://x.com/user/status/123456789

# カスタムファイル名で保存
bun run tw https://x.com/user/status/123456789 my_video.mp4
```

## 必要なもの

- Bun
- FFmpeg（動画の再エンコード）
- 環境変数 `TWITTER_BEARER_TOKEN`（未設定時は公開ウェブクライアントのトークンを使う）

## 注意事項

- プライベートアカウントの動画はダウンロードできません
- 一部の動画は権利上の理由でダウンロードできない場合があります
- Twitter の API 制限により、短時間に大量のダウンロードは避けてください
