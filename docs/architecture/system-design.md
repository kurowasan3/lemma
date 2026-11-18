# システム設計（目標の構成）

前提：[current-architecture.md](current-architecture.md) の監査結果。詳細は各文書に分ける。

| 文書 | 内容 |
| --- | --- |
| [database-design.md](database-design.md) | 表・RLS・データ移行 |
| [privacy-design.md](privacy-design.md) | 匿名利用・削除・収集データ |
| [monetization-design.md](monetization-design.md) | 広告・アフィリエイト・Stripe・SEO |
| [migration-plan.md](migration-plan.md) | 移行手順と実装順序 |
| [mathel-integration.md](mathel-integration.md) | 他サービスとの共通化 |

## 1. 守ること（最重要方針の言い換え）

1. アプリは HTML/CSS/Vanilla JS・ビルドなしのまま。新しいライブラリは原則入れない（Stripe も**ブラウザ側には入れない**。決済はリダイレクト）。
2. `content/ → data/` の生成構造と `data/` の形式（`lemma.data/1`）を変えない。SEO 用ページは `content/` からの**追加の出力**として作る。
3. 問題ID は変えない・再利用しない（`tests/golden/ids.txt` の検査を維持）。
4. 既存の学習記録（`localStorage['lemma.v2']`、`lemma_state`）は**読めるまま残す**。形を変えるときは移行を書き、元に戻せるようにする。
5. ログインしなければ何も送らない、という現在の約束を守る（ゲストは今まで通り）。
6. `tests/run.mjs` の検査はすべて残し、追加するだけにする。

## 2. 目標の構成

```
                        ┌────────────── Cloudflare（DNS・配信。静的ファイルのみ）──────────────┐
                        │                                                                      │
  検索エンジン・SNS ───►│ www.<ドメイン>   公開サイト（SEO）                                    │
                        │   /problems/<問題ID>/  /fields/<分野ID>/  /sitemap.xml  /ads.txt    │
                        │   AdSense・アフィリエイトはここ。ログイン機能なし・記録の保存なし        │
                        │                        │ 「この問題をアプリで解く」                    │
                        │                        ▼                                              │
  利用者（PWA）─────────►│ app.<ドメイン>   アプリ（現行の index.html・js/・data/・sw.js）       │
                        │   第三者スクリプトなし（KaTeX 同梱のみ）・CSP あり                     │
                        └───────────────┬──────────────────────────────────────────────────────┘
                                        │ fetch（Publishable key ＋ ユーザーの JWT）
                                        ▼
                        ┌────────────── Supabase（1プロジェクトを複数サービスで共用）──────────┐
                        │ Auth（メール OTP）                                                    │
                        │ PostgREST：study_state / study_events / entitlements（RLS）          │
                        │ Edge Functions：billing-checkout / billing-portal / stripe-webhook   │
                        │                 transfer（引き継ぎコード）/ entitlement-token         │
                        └───────────────┬──────────────────────────────────────────────────────┘
                                        │ Webhook（署名つき）・API（Secret key は Edge Function だけ）
                                        ▼
                                     Stripe Billing（Checkout・Customer Portal）
```

### 2.1 ホスティング：GitHub Pages から独自ドメイン＋Cloudflare へ

| 案 | 開発コスト | 運用コスト | セキュリティ | 匿名性 | 評価 |
| --- | --- | --- | --- | --- | --- |
| A. GitHub Pages のまま（github.io） | 0 | 0円 | ✕ オリジンを他リポジトリと共有（S1）、ヘッダー設定不可（S3） | ○ | AdSense も実質不可（下記） |
| B. GitHub Pages＋独自ドメイン | 小 | ドメイン代のみ | △ S1 は解消、S3 は残る（ヘッダー不可） | ○ | 暫定なら可 |
| **C. Cloudflare Pages＋独自ドメイン** | 小〜中（CI でデプロイ） | ドメイン代のみ（無料枠） | ○ `_headers` で CSP・HSTS を設定できる | ○（Web Analytics は Cookie なし） | **推奨** |
| D. Vercel／Netlify | 小〜中 | 無料枠あり | ○ | ○ | C と同等。Cloudflare の方が DNS と一体で手間が少ない |

**推奨：C**。理由は、(1) S1・S3 を両方解消できる、(2) AdSense は `ads.txt` をドメインのルートに置く必要があり、`<user>.github.io/<repo>/` では置けない、(3) ドメインを先に決めると、後で URL を変えたときのゲストの記録消失（F7）が1回で済む。
GitHub はソースの置き場のまま残し、GitHub Actions で検査→ビルド→`wrangler pages deploy` する（現在消えている CI もここで復活させる）。

【要検証】Cloudflare Pages の無料枠（ファイル数・ビルド回数）。SEO ページを含めると約5,000ファイルになり、Free の上限（2万ファイル/デプロイ）には収まる見込み。

### 2.2 公開サイトとアプリを別オリジンに分ける理由

| 案 | 内容 | 問題 |
| --- | --- | --- |
| 同一オリジン（`/app/` と `/problems/`） | 構成が単純、SEO の評価がアプリにも集まる | 広告スクリプトがアプリと同じ localStorage（refresh_token を含む）を読める（S2）。SW のスコープも重なる |
| アプリ内広告を iframe で隔離 | 広告だけ別オリジンの iframe に入れる | **AdSense は iframe 内への設置を規約で禁止**しているため使えない |
| **別オリジン（www / app）** | 広告は www だけ。app は第三者スクリプトなし | 有料会員の広告非表示を www に伝える仕組みが要る（[monetization-design.md](monetization-design.md) §3.3） |

**推奨：別オリジン**。アプリの中には第三者スクリプトを入れない、という線を引くと、匿名性・セキュリティ・オフライン動作の説明が単純になる。アプリ内の収益は「一次配信のアフィリエイト枠（画像と自前リンクだけ）」と有料会員に限る。

### 2.3 サーバー側の処理：Supabase Edge Functions を推奨

| 処理 | Supabase Edge Functions | Cloudflare Workers |
| --- | --- | --- |
| Stripe Webhook（DB を書き換える） | Secret key・Stripe の鍵を Supabase 内に閉じ込められる | Supabase の Secret key を Cloudflare にも置く必要がある |
| Checkout／Portal の URL 発行 | JWT の検証が同じプロジェクト内で済む | JWT 検証を自前で書く |
| 引き継ぎコード | 同上 | 同上 |
| 無料枠 | 50万回/月（Free）【要検証】 | 10万回/日 |

**推奨：DB に触る処理はすべて Supabase Edge Functions**。Cloudflare は静的配信と `_headers`・`_redirects` だけにする。秘密鍵の置き場が1か所で済み、漏えい時の影響範囲が小さい。

### 2.4 Supabase のプランと地域

- 本番で課金を始める前に **Pro（$25/月〜）へ上げる**。Free は1週間アクセスがないと一時停止し、自動バックアップもない（F6、【要検証】最新の料金表）。
- 現プロジェクト `lemma`（`tdvsttcepzedxgnigpqx`）をそのまま使い、複数サービスで共用する（[mathel-integration.md](mathel-integration.md)）。地域は【要検証】（東京 `ap-northeast-1` 以外なら遅延を測る）。

## 3. 利用形態と権限

| | ゲスト | 同期ユーザー | 有料会員 |
| --- | --- | --- | --- |
| 識別子 | なし（端末の localStorage のみ） | Supabase の `auth.users.id`（メール OTP） | 同左＋`entitlements` |
| 問題演習・オフライン | ○ | ○ | ○ |
| 学習履歴 | 端末内（最新5,000件） | 端末内＋クラウド（state と、解答ごとの履歴） | 同左。履歴の保持期間・件数の上限なし |
| ブックマーク（新規） | ○ 端末内 | ○ 同期 | ○ |
| 端末の引き継ぎ | ファイル書き出し・引き継ぎコード（新規） | 同期 | 同期 |
| 公開サイトの広告 | 表示 | 表示 | 非表示 |
| 学習分析（詳細） | — | 基本のみ | ○ |

権限の判定は**サーバーの `entitlements` 表が正**（Stripe Webhook だけが書く）。クライアントは表示の切り替えに使うだけ。詳細は [monetization-design.md](monetization-design.md) §4。

## 4. アプリ側のモジュール追加（既存ファイルへの影響を小さく）

| 追加 | 役割 | 既存への変更 |
| --- | --- | --- |
| `js/sync.js`（拡張） | `study_events` の差分同期、`resetAt`（消去の印）、ブックマークの合算 | `mergeState` に項目を足す。既存の項目の合わせ方は変えない |
| `js/account.js`（新規） | 権限（entitlement）の取得とキャッシュ、Checkout・Portal への移動 | `app.js` の設定画面から呼ぶだけ |
| `js/transfer.js`（新規） | 引き継ぎコード（暗号化して一時保存） | 設定画面に入口を足す |
| `js/insights.js`（新規） | 学習分析の画面 | `#insights` のルートを1つ足す |
| `tools/build_site.py`（新規） | `content/` → 公開サイトの静的 HTML・sitemap | `data/` の生成は変えない |

`app.js`（1,731行）を分割したくなるが、**この段階では分割しない**。新機能を別ファイルに作り、`app.js` からは呼ぶだけにする（既存の e2e がそのまま通ることを優先）。

## 5. セキュリティの方針（S1〜S9 への対応）

| 監査の項目 | 対応 | 段階 |
| --- | --- | --- |
| S1 オリジン共有 | 独自ドメインへ移す（2.1） | P1 |
| S2 トークンが localStorage | アプリのオリジンに第三者スクリプトを入れない（2.2）。CSP で `script-src 'self'` に限る | P1 |
| S3 ヘッダーなし | Cloudflare `_headers`：CSP、`Strict-Transport-Security`、`X-Content-Type-Options`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy` | P1 |
| S4 OTP の乱用 | Supabase Auth の CAPTCHA（Cloudflare Turnstile）を**ログイン画面でだけ**読み込む。メール送信のレート制限を設定 | P2 |
| S5 中身の検証なし | `study_state` に大きさ・形の CHECK、`updated_at` はトリガーでサーバー時刻に | P2 |
| S6 読み込みの検証なし | 読み込み時に形を検査し、「合わせる／置き換える」を選ばせる | P2 |
| S7 innerHTML | CSP で被害を限定。`tools/audit_data.py` に `<script` `on*=` `javascript:` の検出を追加 | P1 |
| S8 退会 | 退会前に Stripe の購読を解約する Edge Function を通す（[privacy-design.md](privacy-design.md) §5） | P5 |

CSP の案（アプリ側）：

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self'; connect-src 'self' https://<project>.supabase.co;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

【要検証】KaTeX と既存のインライン `style` 属性の扱い（`style-src 'unsafe-inline'` は必要。インラインの `<script>` は現状ないので `script-src 'self'` で動く見込み）。ログイン画面に Turnstile を入れるときは `script-src` と `frame-src` に `https://challenges.cloudflare.com` を足す。

## 6. 推奨の要約

1. 独自ドメインを取得し、**www（公開サイト・広告）と app（PWA・広告なし）を別オリジン**にする。
2. 配信は Cloudflare Pages、DB に触る処理は Supabase Edge Functions、決済は Stripe のホスト画面（Checkout・Portal）。
3. 学習記録は `lemma_state` の JSONB 方式を**残しつつ**、解答の履歴だけを追記型の表に分ける（[database-design.md](database-design.md)）。
4. 有料の価値は**問題の中身ではなく機能**に置く。問題データは公開リポジトリにあり、隠せないため（[monetization-design.md](monetization-design.md)）。
