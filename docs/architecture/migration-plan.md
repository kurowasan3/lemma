# 移行計画と実装順序

各段階は「既存の機能・テストを壊さない」「戻せる」ことを条件にする。各段階の完了条件には必ず `node tests/run.mjs --e2e` が全部通ることを含める。

## 進捗（2026-11-19、v0.11）

| 項目 | 状態 |
| --- | --- |
| P0 CI の復活 | ✓ `.github/workflows/ci.yml`（検査＋Cloudflare Pages への配置。配置は変数を登録したときだけ） |
| P0 ドメイン・屋号・Supabase の確認 | 未（運営者の作業） |
| P1 配信用ビルド・CSP・noindex・robots.txt | ✓ `tools/build_dist.py`、`tests/e2e_dist.mjs` |
| P1 利用規約（転載・再配布・機械的な収集の禁止） | ✓ `terms.html` |
| P1 Cloudflare への配置・レート制限 | 未（アカウントとドメインが必要。README「公開する」の手順） |
| P1 引き継ぎコード | 未（Edge Function が必要） |
| P2 ブックマーク・ログイン中の消去・ログイン時の確認・読み込みの検査・ログアウト時の消去 | ✓ アプリ側（JSONB のまま、`resetAt` と `bookmarks` を追加） |
| P2 `study_state`・`study_events` への移行 | 未 |

リポジトリは非公開にする方針（2026-11-19）。GitHub の無料プランでは非公開リポジトリから Pages を配信できないので、**非公開にする前に Cloudflare Pages への配置（P1）を済ませる**こと。

## 0. 依存関係

```
P0 土台（CI・ドメイン・屋号）
 ├─► P1 配信の移行（app.<ドメイン>・CSP・引き継ぎコード）
 │     └─► P2 データ層（study_state / study_events・削除・ブックマーク・ログイン時の確認）
 │           ├─► P5 有料会員（Stripe・権限・学習分析）──► P6 Mathel 共通化
 │           └─────────────────────────────────────────────┘
 └─► P3 公開サイト（www・SEO）
       └─► P4 広告・アフィリエイト
                   ▲
 L  法務・ポリシー（特商法・規約・プライバシー改定）── P4・P5 の公開前に必須
```

| 段階 | 前提 | 並行できるもの |
| --- | --- | --- |
| P0 | なし | — |
| P1 | P0 | P3 |
| P2 | P1（新しいオリジンで新しい同期を始めたいため） | P3・P4 |
| P3 | P0（ドメイン） | P1・P2 |
| P4 | P3（広告を載せるページ）、L | P2・P5 |
| P5 | P2（履歴がサーバーにある）、P1（CSP・ドメイン）、L | P4 |
| P6 | P2・P5 | — |

---

## P0 土台（利用者から見える変化なし）

| 作業 | 内容 | 完了条件 |
| --- | --- | --- |
| CI の復活 | `.github/workflows/test.yml`：`pip install openpyxl jsonschema sympy`、`npm i playwright`、`node tests/run.mjs --e2e` | PR・push で ✓ が付く（現在は workflow が無い【確認】） |
| ドメイン | 親ドメインを1つ取得（`.jp` 等）。Cloudflare に DNS を置く | `www.` `app.` が Cloudflare Pages に向く |
| 屋号 | サービス共通の運営者名を決める | 認証メール・ポリシーに使える |
| Supabase の確認 | Postgres の版（`security_invoker` 用に 15 以上）、地域、メール送信の設定 | [current-architecture.md](current-architecture.md) §10 の未確認事項を埋める |

## P1 配信の移行（github.io → app.<ドメイン>）

### 作業

1. Cloudflare Pages の `app` プロジェクトに現行の直下一式を配置（ビルドなし）。`_headers` で CSP・HSTS 等（[system-design.md](system-design.md) §5）。
2. `index.html` に `<meta name="robots" content="noindex">`。
3. `tools/audit_data.py` に `data/` の HTML の危険な文字列（`<script` `on…=` `javascript:`）の検出を追加。
4. **引き継ぎコード**（[privacy-design.md](privacy-design.md) §4.2）：`transfer_codes` 表、Edge Function `transfer`、`js/transfer.js`、設定画面の入口。
5. github.io 側に**最後の版**（v0.10.x）を出す：起動時に「Lemma は app.<ドメイン> に引っ越しました」の帯と、「記録を持っていく」ボタン（引き継ぎコードを作る。ファイル書き出しも併記）。github.io 版はその後も動き続ける（消さない）。

### 移行の考え方（ゲストの記録はオリジンに紐づく）

| 利用者 | 新しい URL での記録 |
| --- | --- |
| ログイン済み | 新しい URL でログインし直せば同期で戻る（追加作業なし） |
| ゲスト（Safari） | 旧 URL で「記録を持っていく」→ コードを新 URL で入力 |
| ゲスト（iOS ホーム画面アプリ） | 旧アプリでコードを作成 → 新 URL を Safari で開き「ホーム画面に追加」→ **追加した新アプリの中で**コードを入力（Safari とホーム画面アプリは保存領域が別のため。案内文で明示） |

### テストの追加

- `tests/e2e.mjs`：`noindex` があること、引き継ぎコードの作成→別コンテキストで復元→記録が一致すること。
- `tests/mock-supabase.mjs`：`transfer` のにせ実装（1回取得したら消える、24時間で失効）。

### 戻し方

DNS を github.io に向け直すだけ（github.io 版は消していない）。引き継ぎコードは独立した機能で、他に影響しない。

## P2 データ層

### 作業（この順で）

1. **SQL**：`study_state`・`study_events`・トリガー・RLS・`reset_my_study`・`delete_my_event`（[database-design.md](database-design.md) §3〜§5）。まずステージング用の Supabase プロジェクト（または `supabase start` のローカル）で。
2. **既存行の移行**：`lemma_state` → `lemma_state_old` に改名 → 移行 SQL → 件数照合 → 互換ビュー `lemma_state`（§6.1）。
3. **アプリ v0.11**：
   - `sync.js`：`study_state` に切り替え、`log` は `study_events` で差分同期（`eventsCursor` を手元に保存）、`PATCH` は `return=minimal`。
   - `mergeState` に `bookmarks`（和集合＋墓標）、`deleted`（墓標）、`resetAt` を足す。**既存の項目の規則は変えない**。
   - ブックマーク機能（問題画面に印、ホームに「ブックマークから出題」）。
   - ログイン直後の「合わせる／使わない」の確認（[privacy-design.md](privacy-design.md) §3）。
   - バックアップ読み込みの検査と「合わせる／置き換える」。
   - 「記録をすべて消す」をログイン中は2択に。
   - 設定画面の文言（F5）を、ログイン状態で出し分け。
4. **Auth の強化**：Turnstile（CAPTCHA）をログイン画面だけで読み込む、外部 SMTP、メール送信のレート制限。
5. 30日後：旧アプリからの `lemma_state` への書き込みが止まったのを確かめ、新アプリの `study_state.state` から `log` を外す。90日後に `lemma_state_old` を削除。

### テストの追加

- `tests/sync.test.mjs`：`study_events` の差分同期（重複を送っても1件、カーソル以降だけ取得）、`resetAt` 以前の手元記録が消える、墓標で消した解答がよみがえらない、ブックマークの合算。
- `tests/mock-supabase.mjs`：`study_state`・`study_events`・RPC のにせ実装。**旧 API（`lemma_state`）も残して**、旧クライアント（v0.10 の `sync.js` を `tests/fixtures/` に固定）と新クライアントが同じ利用者で交互に同期しても記録が失われないことを検査する。
- 実 DB での確認（手動・チェックリスト）：RLS で他人の行が読めない、`study_events` を UPDATE・DELETE できない、旧アプリの GET/POST/PATCH が通る。

### 戻し方

- アプリ：v0.10 に戻す（互換ビューがあるので同期は動く）。
- DB：互換ビューを消し `lemma_state_old` を `lemma_state` に戻す。新アプリが書いた解答は `study_events` に残っているので、再移行時に取り込める。

## P3 公開サイト（www）

1. `tools/build_site.py`：`content/`＋`data/` → `site/`（[monetization-design.md](monetization-design.md) §5.1）。数式は Node の KaTeX でビルド時に HTML 化（`tools/check_katex.cjs` と同じ読み込み方）。
2. CI で `site/` を生成して Cloudflare Pages の `www` プロジェクトへ。`site/` は git に入れない。
3. 最初は分野ページ・問題セット・トップだけを `index`。問題ページは全件作るが、`quality.checks.human = true` 以外は `noindex`（現状は全件 `false`【確認】）。
4. `sitemap.xml`（`index` のページだけ）、`robots.txt`、Search Console の登録。

テストの追加：`tests/site.test.mjs`：全ページの `<title>`・`canonical`・`og:*` があること、`noindex` の判定、sitemap に `noindex` のページが無いこと、アプリへのリンクが `#ids=<存在する問題ID>` であること、非公開列（参考元・メモ）が出ていないこと（`audit_data.py --xlsx` と同じ検査を `site/` にも）。

戻し方：www のデプロイを前の版に戻す（Cloudflare Pages の機能）。アプリには影響しない。

## P4 広告・アフィリエイト

前提：L（プライバシーポリシー改定・ステマ規制の表示）、P3 で一定量のページが索引されていること（AdSense の審査）。

1. `content/books.json` と `data/books.json`、アプリの結果画面・設定画面の枠（自前の画像とリンクだけ）。
2. www に AdSense（非パーソナライズを既定）、`ads.txt`。
3. 有料会員向けの `ent` Cookie を読んで広告を止める処理（P5 の後に有効化。先に「Cookie があれば止める」だけ入れておく）。

テストの追加：アプリのページに外部スクリプトが無いこと（e2e で `document.scripts` の `src` がすべて同一オリジン）、アフィリエイト枠に「PR」表示と `rel="sponsored"` があること。

## P5 有料会員

前提：P2、L（特商法表記・利用規約・未成年の同意文言）、Supabase を Pro に。

1. `billing` スキーマ・`entitlements`（[database-design.md](database-design.md) §3）。
2. Edge Functions：`billing-checkout`・`billing-portal`・`stripe-webhook`・`entitlement-token`・`account-delete`。Stripe はテストモードで全経路を通す。
3. `js/account.js`：権限の取得（24時間キャッシュ）、購入・管理ボタン。退会ボタンを `account-delete` 経由に。
4. `js/insights.js`：詳細な学習分析（`study_events` を読む。端末の5,000件を超える期間はサーバーから取得）。
5. 価格・プランは Stripe の lookup_key で管理。

テストの追加：
- Webhook の単体テスト（署名不正→400、同じイベント2回→1回だけ反映、`subscription.updated` が順不同で来ても最終状態が正しい）。
- e2e：にせの `entitlements` を返して有料表示に切り替わる／期限切れで戻る、オフラインでもキャッシュで24時間は有料表示。

戻し方：購入ボタンを隠す（権限の判定は残す）。既に払った人の権限は `entitlements` に残る。

## P6 Mathel ほか

[mathel-integration.md](mathel-integration.md) §7 の順。Lemma 側の作業は `study-core` の切り出しと、Lemma を core 経由にすること（Lemma の全テストが通ること）。

---

## 実装順序（推奨のまとめ）

| 順 | 作業 | 依存 | 目安 |
| --- | --- | --- | --- |
| 1 | CI の復活（P0） | — | 半日 |
| 2 | ドメイン取得・Cloudflare・屋号（P0） | — | 1日 |
| 3 | app.<ドメイン> への配置・CSP・noindex（P1） | 2 | 1〜2日 |
| 4 | 引き継ぎコード（P1） | 3 | 3〜4日 |
| 5 | github.io に引っ越しの案内（P1） | 4 | 半日 |
| 6 | 公開サイトの生成とデプロイ（P3） | 2 | 4〜6日（4〜5 と並行可） |
| 7 | DB の新しい表・RLS・移行 SQL（ステージング）（P2） | 3 | 2〜3日 |
| 8 | アプリ v0.11（差分同期・削除・ブックマーク・確認画面）（P2） | 7 | 5〜7日 |
| 9 | 本番の DB 移行・Auth 強化（P2） | 8 | 1日＋30日の並行期間 |
| 10 | プライバシーポリシー改定・特商法・規約（L） | — | 法務確認しだい（6〜9 と並行） |
| 11 | アフィリエイト枠・AdSense（P4） | 6, 10 | 2〜3日＋審査 |
| 12 | Supabase Pro・Stripe・Edge Functions・権限（P5） | 9, 10 | 5〜7日 |
| 13 | 学習分析（有料機能）（P5） | 12 | 5日〜 |
| 14 | `study-core` の切り出しと Mathel の接続（P6） | 9, 12 | 5日〜 |

目安は1人で作業した場合の【推測】。

## 主な危険と対策

| 危険 | 対策 |
| --- | --- |
| ドメイン移行でゲストの記録を失う | github.io 版を消さない、引き継ぎコード、ファイル書き出しの3重。帯の案内を3か月出し続ける |
| DB 移行で記録を失う | 改名で旧表を残す、件数照合、互換ビュー、90日保持 |
| 旧アプリ（SW にキャッシュされた v0.10）が新しい DB で壊れる | 互換ビュー `lemma_state` と、新旧クライアント交互同期のテスト |
| 広告で利用者の信頼を失う | アプリ本体には入れない、演習中に出さない、非パーソナライズ |
| AI 生成・改題のページが検索や広告の規約に触れる | 人が確かめた問題だけ索引、出典が特定できる問題は載せない、要法務確認 |
| 有料機能がコード公開で回避される | 端末で完結する機能は回避を許容し、価値はサーバー側（全履歴・同期）と継続的な機能追加に置く |
