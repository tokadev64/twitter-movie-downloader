# de-facto 仕様台帳 (de-facto spec ledger)

出典: 「実装コードから仕様を吸い出して Z3 / TLA+ でバグを洗い出す 実践プレイブック」(mizchi)
<https://gist.github.com/mizchi/db7817e6fc077d567c41bb1c53>

このリポジトリでは Z3 / TLA+ は使わない。プレイブックの §0(3段) / §3(吸い出しの観点) /
§4(モデルの書き方) / §5(検査を効かせ続ける) に沿い、**実装が現に決めて挙動** を吸い出して、
`test`(例) / `pbt`(fast-check) / `e2e`(API・CLI) で **契約 (regression guard)** として固定する。

## 実行の仕方

```bash
bun test            # 単体 + 追加 spec(契約・broken-variant) + e2e を全部
bun run test:e2e    # e2e だけ(実アプリ・実CLIを起動、外部ネットワークは叩かない)
bun run test:spec   # packages/shared/spec の契約 + broken-variant だけ
```

e2e の駆動方法:

- API: `createApp()` の `app.request(path, init, env)` に env を注入し、`globalThis.fetch` をスタブに差し替える
- CLI: `bun --preload e2e/support/cli-fetch-preload.ts packages/cli/mod.ts ...` で fetch をスタブ化し、
  PATH 上に偽 ffmpeg (`e2e/support/fake-ffmpeg/ffmpeg`) を置いて `Bun.spawn` を駆動する

## 凡例

- **主張** … 実装が宣言している仕様(コメント・throw・テスト名・README)。出典付き
- **暗黙** … どこにも書いていないが実装が確定させている挙動
- **INV** … 名前付き不変条件。契約としてロック済み
- **CQ** … 確認質問。現状挙動は契約としてロックしたうえで「意図か?」を保留

## 1. packages/shared/extract-tweet-id.ts

| 型 | 内容 |
|---|---|
| 主張 | 数字のみの入力は tweet ID として扱う。URL は `twitter.com` / `x.com` / `mobile.twitter.com` をサポート(README)。不正なら `Invalid Twitter/X URL` を throw |
| 暗黙 | 前後の空白は trim してから判定。マッチ後部は非anchored で `123abc` → `123` と桁部分だけ取る。ユーザ名は JS の `\w`(ASCII のみ)。`https://evil.example/twitter.com/user/status/123` でも `123` を取り出す(ホスト全体は検証しない) |

固定した契約(`packages/shared/spec/invariants_test.ts`):

- `INV-ID-SHAPE`: 成功結果は常に数字のみ
- `INV-ID-TRIM`: 前後空白は結果に影響しない
- `INV-ID-ROUNDTRIP`: `(twitter|x|mobile.twitter).com / <\w+> / status / <id>` は常にその id を返す
- `INV-ID-EMBEDDED`(現状ロック・**CQ1** 付き): 文字列中に `twitter.com/.../status/<digits>` 部分文字列があれば、
  ほかに埋まっていても抽出する(`https://evil.example/twitter.com/u/status/123` → `123`)
- `INV-ID-REJECT`: `/status/<digits>` 相違を含めず、trim 後も数字のみでない入力は常に throw

確認質問:

- **CQ1(信頼境界)**: URL のホスト全体を検証せず部分文字列で id を抜く。`evil.example` 上の URL でも id が通る。
  API は id しか使わないため直接の被害はないが、意図か? 現状を `INV-ID-EMBEDDED` でロックし、判定待ち
- **CQ2(文字クラス)**: `\w` は ASCII のみで、日本語ユーザ名 (`x.com/あ/status/1`) は拒否される。意図か?

## 2. packages/shared/build-graphql-url.ts + consts.ts

| 型 | 内容 |
|---|---|
| 主張 | `TweetResultByRestId` / 固定 query id / variables と features の JSON を URL に埋める |
| 暗黙 | features・variables のキー列挙順が JSON 文字列にそのまま出る。tweetId は string のまま JSON 化。値は `JSON.stringify` 後に `encodeURIComponent` |

契約:

- `INV-GQL-URL`: 生成 URL は常に `https://api.twitter.com/graphql/<QUERY_ID>/TweetResultByRestId` で始まり、
  tweetId と features が encoding 済みで出る(既存 `build-graphql-url_test.ts` の PBT + e2e の URL マッチでロック)

## 3. packages/shared/extract-media-info.ts

| 型 | 内容 |
|---|---|
| 主張 | `TweetTombstone` は throw。標準は `result.legacy.entities.media`、visibility 制限時は `result.tweet.legacy...`。mp4 は bitrate 降順。HLS は最初の 1 本のみ |
| 暗黙 | mp4 の `quality` は bitrate の文字列。`bitrate` が 0 または欠落だと `"unknown"`(ソート上の扱いは 0)。mp4 全変種に `audioCodec: "AAC"` を固定付与。thumbnail は `https://` 開始値だけ採用。`aspect_ratio` は長さ 2 の配列だけ、`duration_millis` は number だけ採用。解像度/コーデックは URL パースで `/vid/<codec>/<W>x<H>/` が `/vid/<W>x<H>/` より優先(数字だけの codec 文字列にも codec 枝が勝つ: `/vid/123/45x67/` → `videoCodec:"123"`)。`CODEC_MAP` 外は素通し(`vp09` → `vp09`)。mp4 は安定ソート(tie は入力順) |

契約(`packages/shared/spec/invariants_test.ts` + 既存 `extract-media-info_test.ts`):

- `INV-MEDIA-PREDICT`: メディア item 1 個に対し出力は `predictMediaOrder(variants)` と完全一致
  (HLS 先行 → mp4 を `bitrate || 0` 降順・安定、quality 文字列規則)
- `INV-MP4-DESC` / `INV-HLS-SINGLE-FIRST` / `INV-COUNT-TYPES`(photo は 0 件)
- `PROP-ITEM-METADATA`: aspectRatio・durationMs・thumbnailUrl は item 内全条目へ同一値で伝搬(欠落は全条目 undefined)
- `INV-CODEC-PARSE`: 2 パターンと `CODEC_MAP`(avc1→H.264、av01→AV1、それ以外素通し)、部分文字列一致(前後 noise 無視)、`/vid/` なしは undefined
- `ERR-TOMBSTONE` / `ERR-NO-MEDIA` / `ERR-NO-DATA`: 失敗時のメッセージと throw をロック。
  `media` が**配列なら空配列も成功(0 件)**で、欠落・非配列だけが `No media found in tweet`
- 暗黙クラッシュ: `video_info` 欠落は独自エラーではなく `TypeError` で crash(現状ロック)

## 4. packages/shared/sanitize-output-path.ts

| 型 | 内容 |
|---|---|
| 主張 | path traversal 防止。ファイル名を `<stem>.<format>` に正規化 |
| 暗黙 | POSIX `basename` を使うため**バックスラッシュは区切りとして除去されない**(`C:\path\vid.mp4` はそのまま残る)。`"."` → `"..mp4"`、`".."` → `"...mp4"`。拡張子は最後の 1 段だけ(`a.tar.gz` → `a.tar.mp4`)。空文字・`/`・単一バックスラッシュは `twitter_video_<id>.<format>` |

契約:

- `INV-OUT-EQUIV`: `predictOutputPath(input, id, format)` と完全一致
- `INV-OUT-NO-SLASH`: 結果に `/` を含まない(traversal 防止の実体)
- `INV-OUT-EXT`: 結果は必ず `.<format>` 終わりの 1 文字列(POSIX 上)
- `INV-OUT-DEFAULT`: 空・`/`・単一 `\` は既定名

確認質問:

- **CQ3(traversal 主張の範囲)**: 主張は traversal 防止だが、POSIX basename は `\` を除去しない。
  Windows 実行時は別動作になりうる。現状(POSIX 前提)をロックし、判定待ち

## 5. packages/shared/validate-video-url.ts / validate-format.ts

| 型 | 内容 |
|---|---|
| 主張 | https のみ許可。video host は `video.twimg.com` / `pbs.twimg.com`。format は `mp4` のみ(case-sensitive) |
| 暗黙 | `validateVideoUrl` は **scheme だけ**見て host を検証しない(`https://evil.example/v.mp4` は通る)。host 検証は `isAllowedVideoHost` が別途 `URL` の hostname 完全一致で行う(部分一致不可・sub domain 不可・port 可・大文字小文字は hostname 正規化で吸収)。`isAllowedVideoHost` は parse 失敗を `false` に畳む |

契約:

- `INV-HTTPS-ONLY`: `validateVideoUrl` 成功 ⟺ `https://` 開始(throw メッセージ `Invalid video URL: HTTPS required`)
- `INV-HOST-EXACT`: 許可 host 完全一致(+port・大文字許容)は true、prefix/suffix/sub domain は false、parse 失敗は false

確認質問:

- **CQ4(host 検証の二層化)**: `validateVideoUrl` は host を通し、`isAllowedVideoHost` だけが host を絞る。
  呼ぶ側が後者を忘れると外部 host を通す(tweet-download の proxy が該当・CQ9)。二層で意図か?

## 6. packages/api(app・twitter-client・handlers)

| 型 | 内容 |
|---|---|
| 主張 | ルートは `/api/health`、`/api/tweet/:id`、`/api/tweet/:id/download?quality=`。error envelope は `{ data: null, error: { error, code } }`。`TWITTER_BEARER_TOKEN` がないと guest token 取得で失敗 |
| 暗黙 | ステータス分類は catch 内では **message に "Invalid" を含むか** の substring 判定(含む→400 `INVALID_REQUEST`、含まない→502 `UPSTREAM_ERROR`)。download の `quality` 欠落は catch 前の `400 INVALID_REQUEST` / `quality parameter is required`、quality 不一致は `404 NOT_FOUND` / `No video found with quality: <quality>`。URL 形式の `:id` パスパラメータも `extractTweetId` を通る(`encodeURIComponent` 済み URL をそのまま渡せる)。tweet info は HLS を返さない(`quality !== "HLS"` filter)。`enrichWithFileSize` は allowed host の mp4 だけ HEAD(3s timeout)で content-length 付与。HEAD 失敗・non-finite は fail-open(media そのまま)。guest token は module レベル cache で使用条件は `expiresAt > Date.now()`(TTL 30 分ちょうどで再取得)。guest activate 失敗時は cache を作らない。graphql 失敗時は既存 cache を invalidation しない。bearer 欠落は `TWITTER_BEARER_TOKEN environment variable is required`、guest activate 非 OK は `Failed to get guest token: <status>`、graphql 非 OK は `Failed to fetch tweet data: <status>` |

契約(`e2e/api_e2e_test.ts`):

- `INV-API-ENVELOPE`: error 応答は `{ data: null, error: { error, code } }`、tweet info success は `{ data: { tweetId, mediaList }, error: null }`、download success は binary body + `Content-Type: video/mp4` + `Content-Disposition: attachment; filename="twitter_video_<validatedId>.mp4"`
- `INV-API-STATUS`(現状ロック・**CQ5** 付き): catch 内は "Invalid" 含む 400 / 含まない 502 の substring 分類。download quality 欠落は `400 INVALID_REQUEST`、quality 不一致は `404 NOT_FOUND`
- `API-TWEETID-TOLERANT`: URL 形式 id を受理(現状挙動ロック)
- `API-HLS-EXCLUDED` / `API-DOWNLOAD-QUALITY-FIRST` / `API-ENRICH-GATED-FAILOPEN`
- `API-DOWNLOAD-QUALITY-NOT-FOUND`: media 取得後に selected quality が無いと `404` / `code: "NOT_FOUND"` / message `No video found with quality: <quality>`。fetch は guest + graphql のみ
- `API-DOWNLOAD-CQ9`: selected mp4 URL を host 検証なしで fetch して中継する。selected external URL の GET を e2e log で確認
- `API-GUEST-TOKEN-CACHE`: 同一 process 内 2 呼で guest token fetch は 1 回。`expiresAt > Date.now()` が cache 使用条件で、TTL 30 分ちょうど経過で再 fetch
- `CQ6-GUEST-ACTIVATE-FAIL`: guest activate 失敗時は cache 設定なし。次呼では再 activate
- `CQ6-GRAPHQL-FAIL-NONINVALIDATION`: graphql 失敗時は既存 guest cache を invalidation しない
- `API-BEARER-REQUIRED`: env 未設定(`TWITTER_BEARER_TOKEN: ""`)は fetch 前失敗 → 502 `UPSTREAM_ERROR`

確認質問:

- **CQ5(substring 分類)**: エラー種別判定が message 文字列依存。"Invalid" を含まない失敗(bearer 欠落など)は 502 になる。意図か?
- **CQ6(guest token cache)**: guest activate 失敗時は cache しない(401 直後も毎回 activate 再試行)。graphql 失敗時は既存 cache を invalidation しない(TTL 内なら cached token で graphql 再試行)。意図か?

## 7. packages/cli(mod.ts・downloader.ts)

| 型 | 内容 |
|---|---|
| 主張 | URL 形式か数字で受ける。ffmpeg 必須(無ければ exit 1)。HLS は ffmpeg で再エンコード |
| 暗黙 | `DEFAULT_BEARER_TOKEN` をソースに埋め込み、process.env 優先・既定 fallback。mp4 経路は temp(`${output}.temp`)を書き、ffmpeg 出力を**最終ファイルへ直接**書く(HLS 経路は temp(`${output}.temp.mp4`) + rename)。mp4 選択は HLS 優先、mp4 は bitrate 最大。ffmpeg 失敗時: mp4 経路は temp を削除し partial 出力 `${output}` が残りうる、HLS 経路は temp `${output}.temp.mp4` が partial で残り最終ファイル `${output}` は作られない。エラーは stderr `Error: <message>` で exit 1。確認済みの代表メッセージ: `Error: FFmpeg is not installed. Please install FFmpeg first.`、`Error: Invalid Twitter/X URL`、`Error: FFmpeg failed to re-encode video`、`Error: FFmpeg failed to download HLS stream` |

契約(`e2e/cli_e2e_test.ts`):

- `CLI-BEARER-ENV` / `CLI-BEARER-DEFAULT`: env 値が fetch の authorization に、無ければ既定 token
- `CLI-HLS-PREFERRED`: HLS があるときは fetch log が guest + graphql の 2 回だけ、ffmpeg 入力は HLS URL、最終ファイルは rename 後
- `CLI-MP4-HIGHEST-BITRATE`: HLS がないときは bitrate 最大の mp4 URL を GET、ffmpeg 入力は `${output}.temp`
- `CLI-NO-FFMPEG`: ffmpeg 不在時 exit 1、stderr に `FFmpeg is not installed`、fetch 0 回、出力なし
- `CLI-BAD-URL`: exit 1、stderr に `Invalid Twitter/X URL`、fetch 0 回、出力なし
- `CLI-OUTNAME`: path traversal は basename に flatten され、最後の extension だけ format に置換される(`../../weird/vid.tar.gz` → `vid.tar.mp4`)
- torn-write ロック(**CQ7**): mp4 失敗は `${output}` に partial を残し `${output}.temp` を削除、HLS 失敗は `${output}.temp.mp4` を partial で残し `${output}` を作らない

確認質問:

- **CQ7(atomicity の非対称)**: HLS は rename で atomic、mp4 は最終ファイルへ直接書き partial 残留あり。揃えるべきか?
- **CQ8(API と CLI の HLS 扱い)**: API info は HLS を隠し、CLI は HLS を最優先。同じ tweet に対する
  「API から選べる品質」と「CLI が選ぶ品質」が食い違う。統合すべきか?

## 8. broken-variant(検査が load-bearing である証明)

`packages/shared/spec/broken-variants.ts` に意図的に壊した同型実装を置き、
`broken-variants_test.ts` が「壊した実装が該当契約テストに**失敗する**」証跡を持つ:

| broken variant | detect する契約 | 証跡 |
|---|---|---|
| `brokenExtractNoTrim` | INV-ID-TRIM | `" 123 "` が throw した(本物は通る) |
| `brokenSanitizeNoBasename` | INV-OUT-NO-SLASH | `../../etc/passwd` 経路が `/` を保持した |
| `brokenMediaSortAscending` | INV-MP4-DESC | 昇順版 `predictMediaOrder` で述語が false |
| `brokenCodecMapSwapped` | INV-CODEC-PARSE | `avc1` → `AV1` で述語 mismatch |
| `brokenHostSubstringMatch` | INV-HOST-EXACT | `video.twimg.com.evil.io` が true になった |
| `brokenHostErrorFailsOpen` | INV-HOST-EXACT | parse 失敗が true(fail-open)になった |

## 9. 確認質問(CQ)一覧

| ID | 論点 | 現状 | 状態 |
|---|---|---|---|
| CQ1 | extractTweetId の部分文字列一致(信頼境界) | ロック | 判定待ち |
| CQ2 | `\w` ASCII のみ(日本語ユーザ名拒否) | ロック | 判定待ち |
| CQ3 | sanitize の `\` 非除去(POSIX 前提) | ロック | 判定待ち |
| CQ4 | validateVideoUrl の host 未検証 | ロック | 判定待ち(CQ9 連動) |
| CQ5 | "Invalid" substring による 400/502 分類 | ロック | 判定待ち |
| CQ6 | guest token cache の activate/graphql 失敗時の cache 扱い | ロック | 判定待ち |
| CQ7 | mp4 出力の partial 残留(HLS と非対称) | ロック | 判定待ち |
| CQ8 | API の HLS 非表示 vs CLI の HLS 優先 | ロック(両側) | 判定待ち |
| CQ9 | tweet-download proxy が host 検証なしで video URL を中継 | e2e で挙動記録 | 判定待ち(要注意) |
