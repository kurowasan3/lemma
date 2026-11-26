# 現行アーキテクチャ（v0.10.0 時点の監査）

対象：`kurowasan3/lemma` main（コミット `0a2fb0d`、2026-11-13、v0.10.0）。v0.11 で対応した項目は末尾の「v0.11 での変化」にまとめる（本文は v0.10 時点の監査として残す）。この文書はコードを読んで確かめた事実を中心にまとめる。

表記：
- **【確認】** … コード・設定・実行結果で確かめた事実（ファイル名と行番号を付ける）
- **【推測】** … コードからは断定できないが、状況から推測したこと
- **【要検証】** … 外部サービスの設定・実機の挙動など、リポジトリの外を見ないと分からないこと

---

## 1. 全体像

```
                     ┌──────────────────────── GitHub Pages（kurowasan3.github.io/lemma/）───────────────────────┐
 Lemma問題管理表.xlsx │  index.html ── js/app.js（ES Modules）── js/*.js                                          │
 （手元のみ・非公開）  │      │            │                                                                       │
   │ tools/import_xlsx.py   │            ├─ fetch data/index.json・b/<塊>.json・search.json・collections.json  │
   ▼                  │      │            └─ dynamic import('./sync.js') ──► Supabase（Auth・PostgREST）        │
 content/（正規データ）│      sw.js（コード用キャッシュ＋データ用キャッシュ）                                      │
   │ tools/build_app_data.py                                                                                     │
   ▼                  └─────────────────────────────────────────────────────────────────────────────────────────────┘
 data/（アプリ用データ）
```

- 【確認】ビルド工程はなく、リポジトリの直下がそのまま配信される（`README.md`「GitHub Pages で公開する」、`index.html` が `js/app.js` を `type="module"` で直接読む）。
- 【確認】ルーティングは URL のハッシュ（`#today` `#settings` `#ids=…` など）だけ（`js/app.js` `route()` 252行）。ページの URL は実質1つ。
- 【確認】サーバー側の処理は Supabase だけ。独自の API サーバー・Edge Function はない（`supabase/` には `schema.sql` のみ）。
- 【確認】リポジトリは **Public**（`gh api repos/kurowasan3/lemma` → `"visibility":"public"`）。`content/`・`data/` の問題文・答え・解説・選択肢はすべて誰でも取得できる。

## 2. ファイルの依存関係

### 2.1 JavaScript モジュール

| ファイル | 行数 | 役割 | import している相手 |
| --- | ---: | --- | --- |
| `js/app.js` | 1731 | 画面・状態（`state`）・保存・採点の流れ・設定・起動 | ほぼ全部（下記） |
| `js/catalog.js` | 212 | 問題一覧（`data/index.json`）と本文（`data/b/*.json`，問題番号20番ごとの塊）の読み込み、出題の選び方、検索 | `content.js` `scheduler.js` |
| `js/content.js` | 488 | 内蔵問題 61問（`q01`…）と解法カード 45枚 | なし |
| `js/scheduler.js` | 165 | FSRS を簡略化した復習間隔（`review()` `retrievability()`） | `content.js` |
| `js/answer.js` | 438 | 入力用の答え（`lemma-input/1`）の読み取りと採点 | `parser.js` |
| `js/parser.js` | 390 | 数式の構文解析・評価・TeX 化 | なし |
| `js/graph.js` / `graph3d.js` | 538 / 368 | 2D・3D グラフ | `parser.js`（3D は `graph.js` も） |
| `js/drill.js` | 334 | 計算トレーニング | `parser.js` `answer.js` |
| `js/ui.js` | 143 | アイコン・効果音・テーマ・マスコット | なし |
| `js/sync.js` | 212 | Supabase の認証と同期 | `config.js` |
| `js/config.js` | 5 | Supabase の URL と Publishable key | なし |

- 【確認】`sync.js` だけは `import('./sync.js')` で**後から**読む（`app.js` 73行 `initSync()`）。読めなくてもアプリは動く設計。
- 【確認】全ファイルが `FILE_VERSION = '0.10.0'` を持ち、`app.js` の `staleFiles()` が食い違いを赤い帯で警告する（アップロード漏れ対策）。CSS は `--lemma-version`、`sw.js` は `VERSION`。
- 【確認】外部スクリプトは KaTeX（`vendor/` に同梱）だけ。CDN・解析タグ・広告タグはない（`index.html`）。

```
app.js ─┬─ catalog.js ─┬─ content.js
        │              └─ scheduler.js ── content.js
        ├─ answer.js ── parser.js
        ├─ graph.js ── parser.js
        ├─ graph3d.js ─┬─ parser.js
        │              └─ graph.js
        ├─ drill.js ─┬─ parser.js
        │            └─ answer.js
        ├─ ui.js
        └─ (動的) sync.js ── config.js
```

### 2.2 データ生成（Python・Node）

| ツール | 入力 → 出力 |
| --- | --- |
| `tools/import_xlsx.py` | 管理表 → `content/` → `data/`（下の3つをまとめて実行） |
| `tools/xlsx_to_content.py` | 管理表 → `content/problems/*.json`（非公開列「参考元」「メモ」を捨てる） |
| `tools/make_choices.mjs` | `content/problems` の入力用の答え → `content/choices.json`（選択式の誤答） |
| `tools/build_app_data.py` | `content/` → `data/`（`dataVersion` は content の中身から計算） |
| `tools/latex_html.py` | 問題文の LaTeX → HTML（`&` `<` `>` をエスケープ。14行 `esc()`） |
| `tools/audit_data.py` ほか | ID の重複・消失、Schema、KaTeX、採点の検査 |

## 3. データの保存・読み込み経路

### 3.1 問題データ（読み取り専用）

| 段階 | 場所 | 大きさ（2026-11-13） |
| --- | --- | --- |
| 正規データ | `content/problems/<分野ID>.json` ほか | 13 MB |
| 一覧 | `data/index.json`（4,236問の `id/f/lv/t/th/tg/in/ch`） | 0.67 MB |
| 本文 | `data/b/<塊>.json`（`q/a/s/k/in/ch`。HTML 済み。v0.32 から問題番号20番ごと） | 計 約16 MB・289ファイル、1ファイル平均 約57 KB（gzip 約16 KB） |
| 検索索引 | `data/search.json` | 1.5 MB |

- 【確認】起動時に `data/index.json` を `cache: 'no-cache'` で取得（`catalog.js` 34行）。本文は出題する分野のファイルだけ読む（`ensureBodies()`）。
- 【確認】問題本文の HTML は `innerHTML` でそのまま挿入される（`app.js` 905・1123・1146行）。安全性はビルド時のエスケープ（`latex_html.py`）に依存している。

### 3.2 学習記録

```
recordResult() ─► state（メモリ）─► save() ─► localStorage['lemma.v2']
                                       └──► sync.schedule()（ログイン時、20秒まとめて）─► Supabase lemma_state
```

- 【v0.23】保存・移行・控え・退避は `js/store.js`（キーの一覧と仕様は `docs/data-integrity.md`）。以下は v0.22 時点の記述。
- 【確認】保存先は `localStorage` のキー `lemma.v2` の1つだけ（`app.js` 25・68行）。IndexedDB・Cookie は使っていない。
- 【確認】認証情報は別キー `lemma.auth`（`sync.js` 8行）に access_token・refresh_token・メールアドレスを平文 JSON で保存。
- 【確認】`save()` は変更のたびに `state` 全体を `JSON.stringify` して書く（68行）。

## 4. 学習記録（`state`）の構造

【確認】`freshState()`（`app.js` 31行）と書き込み箇所から：

| キー | 形 | 書き込む場所 | 同期の合わせ方（`sync.js` `mergeState`） |
| --- | --- | --- | --- |
| `log` | `[{p, t, g, h, c, ok, sg, min, in, md, disp, note, feel}]`（解答1回＝1要素） | `recordResult()` 603行。**5,000件を超えると古いものから捨てる**（608行） | `p|t` をキーに和集合。5,000件で切る |
| `pstat` | `{問題ID: {S, D, last, reps, lapses}}`（復習状態） | 605行 | 問題ごとに `last` が新しい方 |
| `problems` | `{問題ID: {last, n}}`（解いた回数） | 606行 | `last` は新しい方、`n` は大きい方 |
| `cards` | `{解法カードID: {S, D, last, reps, lapses}}` | 811行 | `last` が新しい方 |
| `explains` | `{問題ID: [{t, text}]}`（気づきのメモ、最新5件） | 847・1251行 | 和集合して最新5件 |
| `streak` | `{last: 'YYYY-MM-DD', count}` | 612行 | 最終日が新しい方 |
| `drill` | `{size, best: {…}}` | `drill.js` 217行 | 自己ベストは正答率→速さ |
| `settings` `practice` `graphExprs` `graph3Exprs` | 設定類 | 各所 | `settingsAt` が新しい方を丸ごと採用（LWW） |
| `schema` `lv0` `newIntroduced` `csvExportedAt` | 管理用 | — | — |

- 【確認】`log` の各要素は自由記述を含みうる：`note`（どこで詰まったか）、`disp`（判定への異議）。`explains` も自由記述。
- 【確認】ブックマーク（お気に入り）の機能は**存在しない**（`bookmark`・`ブックマーク`・`お気に入り` の該当なし）。
- 【確認】大きさの目安（実データの ID で作った模擬記録、`node` で計測）：上限（5,000回・全問に復習状態）で **約1.1 MB**（log 0.59 / pstat 0.33 / problems 0.18 MB）。300回解いた利用者で **約65 KB**。

## 5. 同期の仕組み（`js/sync.js`）

- 【確認】ログインはメールの数字コード（OTP）。`POST /auth/v1/otp`（`create_user: true`）→ `POST /auth/v1/verify`（186・189行）。ライブラリ（supabase-js）は使わず `fetch` で直接呼ぶ。
- 【確認】表 `lemma_state` は1人1行。同期1回の流れ（`syncOnce()` 142行）：
  1. `GET /rest/v1/lemma_state?user_id=eq.<uid>` で**行全体**を取得
  2. 無ければ手元の `state` 全体を `POST`
  3. あれば `mergeState(local, remote)` → 変化があれば `PATCH …&rev=eq.<rev>`（楽観ロック）で**全体**を書き戻す。0行更新なら最大4回取り直す
  4. `PATCH` は `Prefer: return=representation` で**更新後の行全体を返させている**（157行）
- 【確認】同期のきっかけ：起動時、解答後20秒（`schedule()`）、画面が隠れたとき、オンライン復帰時、ボタン。
- 【確認】ログイン直後の最初の同期で、端末の記録とサーバーの記録が**確認なしで**合算される（`verify()` → `syncNow()`）。
- 【確認】ログアウトしても端末の記録は残る（`app.js` 150行の確認文）。

### 5.1 通信量（推計）

同期1回あたり `GET` で行全体、`PATCH` の応答で行全体 ＝ 記録の大きさの**約2倍**の下り通信（egress）が発生する。
上限サイズ（1.1 MB）の利用者が1日30回同期すると 約66 MB/日・約2 GB/月。Supabase Free の egress は月5 GB<sup>※</sup>なので、
**ヘビーユーザー数人で無料枠を使い切る**。300回程度の利用者（65 KB）なら 1日30回でも 約120 MB/月。

※ Supabase Free：DB 500 MB・egress 5 GB・MAU 5万、1週間アクセスがないと一時停止（【要検証】料金表は変わりうる。2026-11 時点の公式料金ページで確認）。

## 6. Service Worker（`sw.js`）

| キャッシュ名 | 中身 | 入れ替え |
| --- | --- | --- |
| `lemma-v0.10.0` | `FILES` の42ファイル（HTML・JS・CSS・KaTeX・フォント・アイコン・`privacy.html`） | `VERSION` を変えると `activate` で古いものを消す |
| `lemma-data-<dataVersion>` | `data/index.json`（install 時）と、開いた `data/*.json` | `index.json` の `dataVersion` が変わったら丸ごと作り直す |

- 【確認】戦略は全リクエスト「ネットワーク優先、失敗したらキャッシュ」（`fetch` ハンドラ）。同一オリジンの GET だけを扱い、Supabase など別オリジンは素通し。
- 【確認】ナビゲーションが失敗すると `./`（アプリ本体）を返す。→ 将来 SEO 用の静的ページを同じオリジン・同じスコープに置くと、オフライン時にアプリ本体が返る。
- 【確認】`claude`・`claudeusercontent` を含むホストでは登録しない（プレビュー環境対策、`app.js` 末尾）。

## 7. テスト・CI

- 【確認】`node tests/run.mjs`：データ監査、Schema、`content/`→`data/` の再現性、内蔵問題の書き出し、入力用の答え、選択肢の整合、KaTeX、採点の回帰、`catalog.js`・`sync.js` の単体テスト（`tests/mock-supabase.mjs` の「にせ Supabase」で RLS まで再現）。`--e2e` で Playwright の通し操作（48項目）と解答形式の操作。
- 【確認】`README.md` は「GitHub Actions でも同じものを実行」と書くが、**リポジトリに `.github/workflows/` が存在しない**。Web からのアップロードで隠しフォルダが落ちた可能性【推測】。現状 CI は動いていない。

## 8. セキュリティ上の問題

重大度は「このまま有料化・広告導入したときの影響」で付けた。

| # | 重大度 | 問題 | 根拠 |
| --- | --- | --- | --- |
| S1 | 高 | **github.io のオリジン共有**。`kurowasan3.github.io` 配下の**他のリポジトリの Pages と localStorage・Service Worker のオリジンが同じ**。別リポジトリに置いたスクリプトから `lemma.auth`（refresh_token）を読める | 【確認】配信先が `https://<user>.github.io/lemma/`。localStorage はパスでなくオリジン単位 |
| S2 | 高 | **トークンが localStorage に平文**。将来、同じオリジンに広告・解析など第三者スクリプトを入れると、そのスクリプトが refresh_token を読める | 【確認】`sync.js` `saveSession()` |
| S3 | 中 | **CSP・セキュリティヘッダーなし**。GitHub Pages ではレスポンスヘッダーを設定できない | 【確認】`index.html` に `Content-Security-Policy` なし |
| S4 | 中 | **ログイン用コードの送信に制限・CAPTCHA がない**（`create_user: true`）。他人のアドレスへの大量送信・アカウントの大量作成ができる。Supabase 側のメール送信レート制限だけが防波堤 | 【確認】`sync.js` 186行。レート値は【要検証】 |
| S5 | 中 | **サーバー側で `state` の中身を検証しない**。自分の行に任意の JSON（5 MB 未満）を書ける。`updated_at` もクライアントが送る値 | 【確認】`schema.sql`（制約は `pg_column_size(state) < 5000000` だけ）、`sync.js` 158行 |
| S6 | 低 | 【v0.23 で対応：`docs/data-integrity.md` §5】**バックアップの読み込みに検証がない**。`problems` と `log` があれば何でも `state` を置き換え、ログイン中はそのままサーバーへ合算される | 【確認】`app.js` 1672–1679行 |
| S7 | 低 | 問題本文 HTML を `innerHTML` で挿入。現状はビルド時にエスケープ済みで問題ないが、`content/` の改ざん（PR・アップロード）がそのまま XSS になる。S2 と組み合わさると影響が大きい | 【確認】`latex_html.py` `esc()`、`app.js` 905行 |
| S8 | 低 | 退会（`delete_my_account`）は `auth.users` を直接消す SECURITY DEFINER 関数。権限は `authenticated` だけで妥当。ただし Supabase のバックアップには一定期間残る（期間は【要検証】） | 【確認】`schema.sql` |
| S9 | 情報 | Publishable key と Project URL の公開は設計どおりで問題ない（RLS で守る前提） | 【確認】`config.js` |

## 9. 機能・運用上の問題（設計に影響するもの）

| # | 問題 | 根拠 |
| --- | --- | --- |
| F1 | **「記録をすべて消す」がログイン中は効かない**。次の同期でサーバーの記録が戻る（確認文にもそう書いてある）。個別の解答を消す手段もない（`log` は和集合なので消してもよみがえる） | 【確認】`app.js` 1680行、`sync.js` `mergeState` |
| F2 | **学習履歴は最新5,000件で切れる**。長期の学習分析（有料機能候補）の材料が残らない | 【確認】`app.js` 608行、`sync.js` 30行 |
| F3 | 同期のたびに記録**全体**を送受信（5.1節）。利用者が増えると egress とDB容量の両方で無料枠を超える | 【確認】 |
| F4 | ハッシュルーティングのため、問題ごとの URL が検索エンジンから見えない（`#ids=…` は1ページ扱い） | 【確認】`route()` |
| F5 | 設定画面の「学習記録はこの端末のブラウザ内だけに保存されます」という文言が、ログイン中は事実と合わない | 【確認】`app.js` 1632行 |
| F6 | Supabase Free は1週間アクセスがないとプロジェクトが一時停止する。有料サービスの本番には向かない | 【要検証】料金表 |
| F7 | 端末の記録はオリジンに紐づく。**配信 URL を変えると、ゲストの記録は新しい URL から見えなくなる** | 【確認】localStorage の仕様 |

## 10. この監査で確かめていないこと

- Supabase ダッシュボードの設定（メールテンプレート、SMTP、レート制限、JWT の有効期限、バックアップ）
- GitHub Pages の設定（カスタムドメインの有無。API が使えず未確認）
- 実際の利用者数・記録の大きさの分布
- Mathel・ぶつりばの実装（このリポジトリの外）

## v0.11 での変化（2026-11-19）

| 監査の項目 | 対応 |
| --- | --- |
| S3 ヘッダーなし | `tools/build_dist.py` が `_headers`（CSP・HSTS など）を出力。Cloudflare Pages に配置すると有効になる（GitHub Pages では効かない） |
| S6 読み込みの検証なし | 形を検査し、「今の記録と合わせる／置き換える」を選ばせる（`app.js` `checkBackup()`） |
| F1 ログイン中の消去が効かない | 消した印 `resetAt` を同期で伝える。「この端末とアカウント」「ログアウトしてこの端末だけ」を選べる |
| F5 文言の不一致 | ログイン状態で出し分け。Safari の7日ルールの注意も追加 |
| 7 CI が無い | `.github/workflows/ci.yml` を追加 |
| 配信範囲 | `dist/` はアプリ本体と `data/` だけ。`content/`・`tools/`・`tests/` は配信しない（`tests/e2e_dist.mjs` で確認） |
| ログイン直後の確認なしの合算 | 端末とアカウントの両方に記録があるときだけ確認（`firstSyncAfterLogin()`） |
| 保存の失敗が黙って起きる | 1回だけ知らせる。初めて解いたときに `navigator.storage.persist()` を要求 |

新しく分かったこと：`js/parser.js` の `compile()` が `new Function` を使うため、CSP に `'unsafe-eval'` が必要（system-design §5 を修正）。
