# データベース設計

対象：Supabase PostgreSQL（現プロジェクト `lemma`）。現状は `supabase/schema.sql` の1表＋1関数。

## 1. 現在の `lemma_state` の問題点

【確認】`supabase/schema.sql`：`lemma_state(user_id PK, state jsonb, rev int, updated_at timestamptz)`、RLS は本人のみ、`pg_column_size(state) < 5000000`。

| # | 問題 | 影響 |
| --- | --- | --- |
| D1 | 1人1行に記録**全体**を入れ、同期のたびに全体を GET・PATCH（応答も全体） | 上限サイズの利用者（約1.1 MB）は1回の同期で約2.2 MBの下り通信。無料枠 egress 5 GB/月を数人で使い切る（current-architecture §5.1） |
| D2 | 解答履歴 `log` が5,000件で切れる | 長期の学習分析ができない。有料機能「高度な学習分析」の材料にならない |
| D3 | 消去を表せない（和集合で合わせるため、消した解答・消した記録がよみがえる） | 「記録を消す」「この解答を消す」が実現できない（プライバシー上も問題） |
| D4 | サービスを区別する列がない | Mathel など他サービスを同じプロジェクトに載せられない |
| D5 | `updated_at` をクライアントが送る | 監査・不正調査に使えない |
| D6 | 中身の形をサーバーで検証しない | 壊れた記録・巨大な記録がそのまま入る |
| D7 | 集計が SQL でできない（JSONB の中の配列） | 運営側の品質分析（どの問題の正答率が低いか等）が難しい |

一方、良い点もある：1行なので**楽観ロック（`rev`）で整合性を保ちやすい**、クライアントの `mergeState` とテストが揃っている、行が小さい利用者が大半なら十分軽い。

## 2. JSONB を維持するか、分割するか

| 案 | 内容 | 開発コスト | 運用コスト | 整合性 | 移行の危険 |
| --- | --- | --- | --- | --- | --- |
| A. 現状維持 | `lemma_state` のまま | 0 | ✕ egress・容量が利用者数と記録量に比例して増える | ○ | なし |
| **B. 混合（推奨）** | 小さく頻繁に変わるもの（復習状態・設定・ブックマーク）は JSONB の1行に残し、**増え続ける解答履歴だけを追記型の表 `study_events` に分ける** | 中 | ○ 同期は差分だけ | ○ 履歴は `(user, service, p, t)` で一意＝今の `p|t` と同じ規則 | 小（既存の `mergeState` の規則をそのまま表に写せる） |
| C. 完全正規化 | 復習状態も問題ごとの行（`problem_stats`）、設定も列に | 大 | ◎ | △ 項目ごとの合わせ方をサーバーに移す必要 | 大（クライアントの全面書き換え） |

**推奨：B**。理由：
- 通信量の大半（約54%）は `log`。これを差分同期にするだけで D1 の大部分が解決する。
- 現在の合わせ方「`p|t` をキーに和集合」は、**一意制約つきの INSERT（重複は無視）**とまったく同じ意味になる。クライアントの考え方を変えずに済む。
- `pstat`（0.33 MB）・`problems`（0.18 MB）は上限でもこの程度で、問題ごとに「新しい方」で合わせる規則がクライアントで完成している。C で得られる利点に対して書き換えの危険が大きい。

## 3. 表の設計

### 3.1 一覧

| スキーマ.表 | 役割 | 誰が書くか |
| --- | --- | --- |
| `public.study_state` | サービスごとの状態（JSONB）。`lemma_state` の後継 | 本人（RLS） |
| `public.study_events` | 解答の履歴（追記のみ） | 本人（RLS、INSERT のみ） |
| `public.lemma_state` | **互換用のビュー**（v0.10 以前のアプリがそのまま動くように） | 本人（RLS） |
| `public.entitlements` | 権限（有料会員かどうか）。サービス別 | Edge Function（service_role）のみ |
| `billing.customers` | `user_id` ↔ Stripe の顧客ID | 同上 |
| `billing.subscriptions` | Stripe の購読の写し | 同上 |
| `billing.stripe_events` | 処理済みの Webhook（二重処理の防止） | 同上 |
| `public.transfer_codes` | 引き継ぎコード（暗号化済みの一時データ） | Edge Function のみ |

`billing` スキーマは PostgREST に**公開しない**（Supabase の「Exposed schemas」に入れない）。決済の情報と学習データを API の面から分ける。

### 3.2 定義（案）

```sql
-- サービスの種類（増やすときはここに足す）
create type public.service_id as enum ('lemma', 'mathel', 'butsuriba');

-- 状態：1人1サービス1行（今の lemma_state と同じ考え方）
create table public.study_state (
  user_id    uuid not null references auth.users(id) on delete cascade,
  service    public.service_id not null,
  state      jsonb not null,
  rev        integer not null default 1,
  reset_at   bigint not null default 0,          -- この時刻（ms）より前の履歴は消したもの（§5）
  updated_at timestamptz not null default now(),
  primary key (user_id, service),
  constraint state_size check (pg_column_size(state) < 2000000),
  constraint state_is_object check (jsonb_typeof(state) = 'object')
);

-- 解答の履歴：追記のみ。今の log の1要素＝1行
create table public.study_events (
  user_id    uuid not null references auth.users(id) on delete cascade,
  service    public.service_id not null,
  problem_id text not null check (length(problem_id) <= 40),
  t          bigint not null,                    -- 解いた時刻（ms）。今の log の t
  grade      smallint not null check (grade between 1 and 4),
  data       jsonb not null default '{}'::jsonb, -- h, c, ok, sg, min, in, md, disp, note, feel …
  created_at timestamptz not null default now(), -- 差分同期のカーソル（サーバー時刻）
  primary key (user_id, service, problem_id, t),
  constraint data_size check (pg_column_size(data) < 4000)
);
create index study_events_sync on public.study_events (user_id, service, created_at);

-- updated_at はサーバー時刻にする（D5）
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger study_state_touch before insert or update on public.study_state
  for each row execute function public.touch_updated_at();

-- 権限（サービス別。'all' はまとめ買い）
create table public.entitlements (
  user_id    uuid not null references auth.users(id) on delete cascade,
  service    text not null check (service in ('all', 'lemma', 'mathel', 'butsuriba')),
  plan       text not null,                      -- 'plus' など
  status     text not null,                      -- Stripe の status を写す
  valid_until timestamptz not null,              -- current_period_end（＋猶予）
  updated_at timestamptz not null default now(),
  primary key (user_id, service)
);
```

`problem_id` を外部キーにしない理由：問題データは `content/` にあり DB には無い。ID の正しさはクライアントと `tests/golden/ids.txt` が保証する。

### 3.3 `study_events` で差分同期する流れ

```
1. GET study_state（小さい：復習状態・設定・ブックマーク）… 今と同じ rev つきの楽観ロック
2. POST study_events（前回の同期以降に手元で増えた解答だけ）
     Prefer: resolution=ignore-duplicates   ← p|t が同じものは無視（今の和集合と同じ）
3. GET study_events?created_at=gt.<前回のカーソル>&order=created_at   ← 他の端末で増えた分だけ
4. 手元の log に足す（5,000件の上限は端末側だけに残す）
```

- 通信量は「増えた分」だけになる。上限サイズの利用者でも、1回の同期は数 KB〜数十 KB。
- `PATCH` の `Prefer: return=representation` はやめ、`return=minimal` にする（D1）。
- 端末の `log` は今まで通り最新5,000件。**サーバーには全件残る**ので、学習分析はサーバーの履歴から作れる（D2）。

## 4. RLS（行単位のアクセス制限）

| 表 | select | insert | update | delete |
| --- | --- | --- | --- | --- |
| `study_state` | 本人 | 本人 | 本人 | 本人 |
| `study_events` | 本人 | 本人（`t` がサーバー時刻＋1日以内） | **不可** | 不可（関数経由のみ §5） |
| `entitlements` | 本人 | 不可 | 不可 | 不可 |
| `billing.*` | 不可（API に公開しない） | — | — | — |
| `transfer_codes` | 不可（Edge Function のみ） | — | — | — |

```sql
alter table public.study_state  enable row level security;
alter table public.study_events enable row level security;
alter table public.entitlements enable row level security;

create policy "own state" on public.study_state for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "read own events" on public.study_events for select
  using ((select auth.uid()) = user_id);
create policy "add own events" on public.study_events for insert
  with check ((select auth.uid()) = user_id and t <= (extract(epoch from now()) * 1000)::bigint + 86400000);

create policy "read own entitlements" on public.entitlements for select
  using ((select auth.uid()) = user_id);
```

- `auth.uid()` を `(select auth.uid())` で包むのは、行ごとに関数を呼ばせないため（Supabase の RLS の推奨）。
- **有料機能の判定を RLS に入れる**のは「サーバーに置く有料データ」だけにする（例：一定期間より古い `study_events` の閲覧を有料に限る、など）。今の段階では履歴は全員が自分の分を読める設計にし、有料の線引きは機能側で行う（[monetization-design.md](monetization-design.md) §4）。

### 4.1 互換用ビュー `lemma_state`

v0.10 以前のアプリ（端末に Service Worker でキャッシュされている）は `/rest/v1/lemma_state` を叩き続ける。移行後もしばらく動かすため、同じ名前・同じ列のビューを置く。

```sql
create view public.lemma_state with (security_invoker = true) as
  select user_id, state, rev, updated_at from public.study_state where service = 'lemma';
-- 単一表・単純な WHERE のビューは自動で更新可能。INSERT 時の service はトリガーで補う
create function public.lemma_state_insert() returns trigger language plpgsql
security invoker as $$
begin
  insert into public.study_state (user_id, service, state, rev) values (new.user_id, 'lemma', new.state, new.rev);
  return new;
end $$;
create trigger lemma_state_insert instead of insert on public.lemma_state
  for each row execute function public.lemma_state_insert();
```

【要検証】`security_invoker` は PostgreSQL 15 以降。Supabase のプロジェクトの版を確認し、ステージングで「旧アプリでの GET・POST・PATCH（`rev=eq.` つき）・RLS」が通ることを `tests/mock-supabase.mjs` と実 DB の両方で確かめる。
旧アプリは `state.log` を JSONB に書き続けるので、移行期間中は `study_state.state.log` も残す（§6）。

## 5. 削除の表し方（D3）

【確認】v0.11 で、`study_events` を待たずに **JSONB のままで** 消去が効くようにした：`state.resetAt`（消した時刻、ms）を持たせ、`js/sync.js` の `mergeState` が「印の古い側からは、その時刻より前の記録（解答・復習状態・メモ・ブックマーク・自己ベスト）を持ち込まない」。
ブックマークは `state.bookmarks = { 問題ID: { on, t } }` で、外した印（`on:false`）を残して和集合でよみがえらないようにした。
下の表は `study_events` を導入したあとの、サーバー側での対応。

| 操作 | 実装 |
| --- | --- |
| 記録をすべて消す（ログイン中） | `rpc('reset_my_study', {service})`：`study_events` の本人・サービスの行を消し、`study_state` を初期値にして `reset_at = 現在時刻` にする。各端末は同期時に `reset_at` を見て、それより前の手元の `log`・`pstat` を捨てる（クライアントの `mergeState` に1項目足す） |
| 1回分の解答を消す | `rpc('delete_my_event', {service, problem_id, t})`。手元には `deleted: ["p|t", …]`（墓標、最大1,000件）を `study_state` に持たせ、他の端末の和集合でよみがえらないようにする |
| 退会 | 既存の `delete_my_account()` を残す（`on delete cascade` で全表から消える）。有料会員は先に Edge Function で購読を解約（[privacy-design.md](privacy-design.md) §5） |

```sql
create function public.reset_my_study(p_service public.service_id) returns void
language plpgsql security invoker set search_path = '' as $$
declare now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  delete from public.study_events where user_id = (select auth.uid()) and service = p_service;
  update public.study_state set state = '{}'::jsonb, rev = rev + 1, reset_at = now_ms
    where user_id = (select auth.uid()) and service = p_service;
end $$;
-- study_events の delete は RLS で禁止しているので、この関数だけは security definer にして本人の行に限る（実装時に決める）
```

## 6. データ移行

### 6.1 既存行の移行（1回だけ実行する SQL）

```sql
begin;
-- 1) 状態を新しい表へ（state はそのまま。旧アプリ用に log も残す）
insert into public.study_state (user_id, service, state, rev, updated_at)
  select user_id, 'lemma', state, rev, updated_at from public.lemma_state_old;
-- 2) 履歴を1行ずつに展開
insert into public.study_events (user_id, service, problem_id, t, grade, data)
  select s.user_id, 'lemma', e->>'p', (e->>'t')::bigint, greatest(1, least(4, (e->>'g')::int)),
         e - 'p' - 't' - 'g'
  from public.lemma_state_old s, jsonb_array_elements(s.state->'log') e
  where e ? 'p' and e ? 't'
  on conflict do nothing;
commit;
```

手順（詳細は [migration-plan.md](migration-plan.md) P2）：
1. `pg_dump` でバックアップ（Pro なら自動バックアップも確認）。
2. `alter table public.lemma_state rename to lemma_state_old;`
3. 上の SQL で移す → 件数を照合（`count(*)` と `sum(jsonb_array_length(state->'log'))`）。
4. 互換ビュー `lemma_state` を作る。
5. 旧アプリ・新アプリの両方で同期を確かめる。
6. 30日後、旧アプリからの書き込みが止まったことを確かめてから、`state.log` を JSONB から外す（新アプリは `log` を送らない設定に切り替え）。`lemma_state_old` は90日残してから消す。

**戻し方**：4 の前なら名前を戻すだけ。4 の後は、ビューを消して `lemma_state_old` の名前を戻す（その間に新アプリが書いた分は `study_events` に残るので、再移行で失われない）。

### 6.2 端末の記録（localStorage）

- `lemma.v2` の `schema` は 4 のまま。新しい項目（`bookmarks`、`deleted`、`resetAt`、`eventsCursor`）は**足すだけ**で、古いアプリは無視する（`load()` が `{...freshState(), ...JSON.parse(raw)}` で読むため、知らない項目はそのまま残る【確認】）。
- 形を変える必要が出たときだけ `schema` を 5 に上げ、`load()` に移行処理を書く（`docs/data-spec.md`「版は3つを分ける」の決まりどおり）。

## 7. 容量の見積もり

`study_events` 1行 ≒ 行のオーバーヘッド＋列＋`data`（約60 B）で **150〜200 B**（【推測】実測で確かめる）。

| 利用者 | 解答数/人 | 履歴の量 |
| --- | --- | --- |
| 1,000人 × 年1,000回 | 100万行 | 約150〜200 MB |
| 1万人 × 年1,000回 | 1,000万行 | 約1.5〜2 GB（Pro の 8 GB 内） |

Free の 500 MB は同期ユーザー数千人規模で足りなくなる。有料化の時点で Pro に上げる前提（system-design §2.4）。
