# Mathel ほか他サービスとの共通化

## 0. 前提（確認できた範囲）

- 【確認】このリポジトリ（Lemma）の同期は `js/sync.js` と表 `lemma_state` だけで、サービスを区別する仕組みはない。
- 【推測】Mathel（大学数学）・ぶつりば（大学物理）は Lemma と「同じ形式」の静的アプリとして作られている／作られる予定。どちらもこの監査の対象外で、**Supabase を使っているか、記録の形が Lemma と同じかは未確認**。
- 方針：サービスごとのアプリ（リポジトリ・ドメイン・PWA）は**別のまま**にし、アカウント・決済・権限だけを共通にする。

## 1. 共通化の範囲

| 項目 | 共通にする | サービス別にする |
| --- | --- | --- |
| アカウント（Supabase Auth） | ○ 1つのプロジェクト・1つのユーザー表 | — |
| 決済（Stripe） | ○ 1つの Stripe アカウント・1人1顧客 | 商品（Product）・価格はサービス別＋まとめ買い |
| 権限（`entitlements`） | ○ 1つの表 | 行がサービス別（`service` 列） |
| 学習記録（`study_state`・`study_events`） | 表は共通 | 行がサービス別（`service` 列）。中身の形は各サービスが決める |
| 問題データ（`content/`・`data/`） | — | ○ 完全に別（ID の体系も別） |
| 配信（ドメイン・PWA・SW） | 親ドメインだけ共通 | ○ サブドメイン別（`lemma.` `mathel.` …）→ localStorage も別 |
| 同期・権限のクライアントコード | ○ 共通モジュール（§4） | 合わせ方（`mergeState`）はサービス別に差し替え |

## 2. 共通認証

| 案 | 内容 | 評価 |
| --- | --- | --- |
| A. サービスごとに Supabase プロジェクト | 完全に分離 | 同じ人が別アカウント・別決済になる。Free は2プロジェクトまで |
| **B. 1プロジェクトを共用、ログインはサービスごと** | 同じメールでログインすれば同じユーザー | **推奨**。実装は今の `sync.js` のまま |
| C. B＋サービス間のシングルサインオン | 1回のログインで全サービス | サブドメイン間でセッションを共有するには Cookie ベースの保存が必要で、今の fetch 直書きの設計から外れる。利点が小さい |

**推奨：B**。各アプリは自分のオリジンの localStorage に自分のセッションを持つ。同じメールアドレスなら Supabase 上は同じ `auth.users.id` になるので、権限・決済は自然に共通になる。

注意点：
- Supabase の認証メールの文面はプロジェクトで1つ。**サービス名を出さない共通の文面**（「学習アプリ共通アカウントのログインコード」）にする。
- 現プロジェクト名 `lemma` は表示上の名前で、URL（`tdvsttcepzedxgnigpqx`）は変わらない。名前はそのままでよい。
- 退会は「全サービスのアカウントを消す」ことになる。退会画面にそう書き、サービス単位の「記録だけ消す」（`reset_my_study(service)`）と区別する。

## 3. 共通決済・共通ユーザー管理

```
Stripe
 ├─ Product: Lemma Plus      ─ Price: 月額 / 年額（lookup_key: lemma_plus_monthly …）
 ├─ Product: Mathel Plus     ─ Price: 月額 / 年額
 └─ Product: まとめ（All）    ─ Price: 月額 / 年額
      │ Price の metadata に service = lemma | mathel | all
      ▼
stripe-webhook ─► entitlements(user_id, service, plan, status, valid_until)
```

- 1人1つの Stripe 顧客（`billing.customers.user_id` が主キー）。複数サービスを買っても請求の宛先は1つ。
- 権限の判定は各アプリで `service in (<自分>, 'all')`。
- まとめ買いと単品の両方を持っている場合は、`valid_until` が遅い方を使う（Webhook 側で整理する必要はない）。
- Customer Portal で、購読の切り替え（単品→まとめ）を許可する（Stripe の Portal 設定）。

## 4. 共通モジュールの配り方

ビルド工程のない静的アプリなので、npm パッケージにはしない。

| 案 | 内容 | 評価 |
| --- | --- | --- |
| A. 各リポジトリに手でコピー | 単純 | 版がずれる |
| B. git submodule | 版を固定できる | Web からのアップロード運用（README の手順）と相性が悪い |
| **C. 共通リポジトリ＋取り込みスクリプト** | `study-core` リポジトリに `sync-core.js`（通信・認証・差分同期）、`entitlement.js`、`transfer.js` を置き、各アプリの `tools/vendor_core.sh <版>` で `js/core/` にコピー | **推奨**。今の `FILE_VERSION` による食い違い検出をそのまま使える |

分け方：

```
js/core/sync-core.js   … ログイン・トークン更新・study_state の楽観ロック・study_events の差分同期（サービス名は引数）
js/core/entitlement.js … 権限の取得とキャッシュ、Checkout・Portal への移動
js/core/transfer.js    … 引き継ぎコード
js/sync.js（各アプリ） … mergeState（何をどう合わせるか）と、core への受け渡しだけ
```

Lemma の現在の `sync.js` を「core（通信）」と「Lemma 固有（`mergeState`）」に分けるのが最初の作業。`tests/sync.test.mjs` と `tests/mock-supabase.mjs` も core 側に移し、各アプリは Lemma 固有の合わせ方のテストを残す。

## 5. サービス別の学習履歴

- `study_state(user_id, service)`・`study_events(user_id, service, problem_id, t)`。`problem_id` の体系はサービスごとに自由（Lemma は `III-INT-001`、Mathel は別の規則）。
- サービス間で問題ID が衝突しても、主キーに `service` が入っているので問題ない。
- サービス横断の分析（「全サービスでの学習時間」など）は、将来やるとしても `study_events` を `user_id` で集めるだけで済む。

## 6. 将来の複数サービス展開で決めておくこと

| 項目 | 決めること | 推奨 |
| --- | --- | --- |
| ドメイン | 親ドメイン1つ＋サービスごとのサブドメイン | `lemma.<ドメイン>`（アプリ）、`www.<ドメイン>/lemma/`（公開サイト）など。親ドメインを先に取る |
| サービスID | `service_id` 型の値 | `lemma` `mathel` `butsuriba`。後から足すときは `alter type … add value` |
| 共通のブランド名 | 認証メール・決済画面・ポリシーに出す名前 | サービス名とは別の運営者名（屋号）を1つ決める |
| プライバシーポリシー・規約 | 共通1つか、サービスごとか | **共通1つ**（委託先・決済が共通のため）。サービス固有の記述は節を分ける |
| Supabase の容量 | 全サービスの合計で見積もる | Pro（8 GB）で当面足りる見込み（[database-design.md](database-design.md) §7） |

## 7. 移行の順番（Mathel 側）

1. Lemma で P2（`study_state`・`study_events`、[migration-plan.md](migration-plan.md)）を終え、`service` 列の設計を実運用で確かめる。
2. `study-core` を切り出し、Lemma を core 経由に置き換える（Lemma の全テストが通ること）。
3. Mathel に core を取り込み、`service = 'mathel'` で同期を有効にする（Mathel に既存の記録があれば、Lemma と同じ「端末の記録をそのまま最初にアップロード」の流れで移る）。
4. 権限（`entitlements`）を `service in ('mathel','all')` で読むようにする。
