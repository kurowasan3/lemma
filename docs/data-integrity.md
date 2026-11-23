# 学習記録の保全（v0.23〜v0.26）

学習記録を失わないための仕組み。実装は `js/store.js`（保存・移行・点検・バックアップ・合わせ方）、
`js/sync.js`（通信）、`js/app.js`（画面からの呼び出し）。テストは `tests/store.test.mjs`・`tests/store_edge.test.mjs`・`tests/sync.test.mjs`・`tests/server_guard.test.mjs`・`tests/e2e.mjs`。
サーバー側の書き込み制限は `supabase/guard.sql`（Supabase で実行が必要。§6）。

## 1. 保存しているもの

| 保存先（localStorage のキー） | 中身 | 同期 | バックアップ |
|---|---|---|---|
| `lemma.v2` | 学習記録の本体（下の表） | する | 含む |
| `lemma.snap.v1` | 自動の控え（最大2件。移行・読み込み・消去の前の `lemma.v2` の文字列） | しない | 含まない |
| `lemma.v2.broken.<時刻>` | 読めなかった記録の退避（元の文字列そのまま） | しない | 含まない（設定から個別に書き出せる） |
| `lemma.session.v1` | 中断した演習（14日で捨てる） | しない | 含まない |
| `lemma.auth` | ログイン情報（トークン） | — | 含まない（安全のため） |

IndexedDB・Cookie は使っていない。サーバー（Supabase）は表 `lemma_state` に1人1行（`state` に `lemma.v2` と同じ形、`rev` に版番号）。

`lemma.v2` の中身（schema 4）：

| キー | 形 | 意味 |
|---|---|---|
| `log` | `[{ p, t, g, ok?, sg?, c?, h?, min?, in?, md?, k?:'t', r?:1〜3, note?, disp?, feel? }]` | 解答の記録。`p` 問題ID・`t` 時刻(ms)・`g` 評価1〜4。**`(p, t)` が1回の解答の識別子** |
| `pstat` | `{ 問題ID: { S, D, last, reps, lapses } }` | 問題ごとの復習状態（`scheduler.js` `review()`） |
| `problems` | `{ 問題ID: { last, n } }` | 最後に解いた時刻と回数 |
| `cards` | `{ 解法カードID: { S, D, last, reps, lapses } }` | 解法カード（`js/content.js` の CARDS）の復習状態 |
| `bookmarks` | `{ 問題ID: { on, t } }` | ブックマーク（外すと `on:false` を残す） |
| `explains` | `{ 問題ID: [{ t, text }] }` | 気づきのメモ（問題ごとに新しい5件） |
| `streak` `drill` `csvExportedAt` | | 連続日数・計算トレーニングの自己ベスト・CSV書き出し時刻 |
| `settings` `practice` `graph*Exprs` `settingsAt` | | 設定（最後に変えた方を採る） |
| `resetAt` | 時刻 | 「すべて消す」「置き換え」をした印（同期で古い記録を持ち込まない） |
| `localResetAt` | 時刻 | この端末で「ログアウトして消す」等をした印（v0.24。同期しない。ほかのタブの古い記録を持ち込まない） |
| `schema` `lv0` | | 記録の形の版・移行済みの印 |

解法（Technique）の習熟は `log` から毎回計算する（`mastery.js`）ので、保存していない。
問題ID・解法IDは変えない（`tests/golden/ids.txt`・`techniques.txt` で検査）。

## 2. ローカル保存（`createStore().save()`）

読み書きは「成功・無い・失敗」を区別する（`getItem` の例外を「記録が無い」とは扱わない）。保存の手順：

1. 保存を止めている理由（`blocked`）があれば書かない。`read`（前に読めなかった）だけは、ここで読み直し、読めれば解除して続ける。
2. 保存しようとする記録の `schema` が `SCHEMA` より大きければ書かない（`newer`）。構造が正しくなければ書かない（`invalid`）。JSON にできなければ書かない（`serialize`）。
3. 保存されている記録を読む。読めなければ書かない（`read`）。
4. それが、このタブが最後に読み書きした文字列と違えば（別のタブ・読めなかった間に保存された記録）：
   - 読めない・形が壊れている → 退避してから進む（退避できなければ `broken` で止める）
   - 新しい schema → 書かず、このタブの保存を以後止める（`newer`）
   - 正しい記録 → `mergeTabs` で合わせる。合わせた結果が保存されている記録と同じなら書かない（タブどうしで書き込みが行ったり来たりしない）
5. `setItem`。容量不足（`QuotaExceededError` など）なら古い控えを1つずつ捨てて再試行（本体の新しい記録を優先）、捨てる控えが無ければ `quota`。容量以外の失敗は `write`。どちらも**前の値のまま残る**。
6. 読み返す。読めなければ `verify_read`、内容が違い、それが別のタブが直後に書いた正しい記録なら 3 に戻って合わせ直す（最大4回。収まらなければ `conflict`）。正しい記録でなければ `verify`。

失敗の理由は画面に1回知らせる（`app.js` `SAVE_MSG`）。失敗しても画面の記録は消さない。読み返しに失敗した後の保存は、保存されている記録と合わせてから書く。

保存している記録が300万文字を超えたら1回知らせる（§9）。

## 3. 読み込み（起動時の `load()`）

| 状態（status） | 処理 | 保存 |
|---|---|---|
| `new` 何も無い | 新しい記録 | する |
| `unavailable` 読めない（`getItem` の例外） | 新しい記録で画面を動かすが、**記録が無いとは扱わない** | 止める。保存のときに読み直し、読めたら保存されている記録と合わせてから保存 |
| `broken` JSON として読めない | 元の文字列を `lemma.v2.broken.<時刻>` に退避 | 退避できたらする（退避分は残る）。できなければ止める |
| `salvaged` 一部の形が壊れている | 元を退避し、壊れた入れ物だけ初期値、ほかは使う | 退避できたらする |
| `migrated` 古い schema | 移行（§4）。移行の前に控えを残す | する |
| `migrate_failed` 移行の途中で例外 | 元を退避し、移行前の形のまま画面で使う | **止める**（本体の元の記録を残し、次の起動で再試行できるように） |
| `newer` 新しい schema | 形を変えずに画面で使う | **止める**（§4） |

いずれも起動時にバナーで知らせる。`localStorage` そのものが使えない環境（一部のプライベートモード）だけは、画面の中だけで動き、その旨を知らせる。

## 4. schema と移行・新しい schema の保護

- 今の版：`SCHEMA = 4`。読める最も古い版：`MIN_SCHEMA = 1`（v0.1）。schema の無い記録は 1 とみなす。
- `MIGRATIONS`：版ごとの手順（`from` → `from+1`）。`PATCHES`：版を変えない正規化（`lv0`）。
- 各手順はコピーに対して動く純関数で、何度実行しても同じ（二重の移行をしない）。移行の後に構造を確かめる。
- 移行の途中で失敗したら、本体には書かない（`migrate_failed`）。直った版のアプリで再読み込みすると、もう一度移行する。
- schema 1〜3 → 4 は演習の「選択」だけを初期化する。解答の記録・復習状態は変えない。

**新しい schema の記録を、このアプリ（v0.24 以降）は上書きしない**：

| 場面 | 守り方 |
|---|---|
| 起動時に新しい schema を読んだ | `blocked = 'newer'`。保存・置き換え（読み込み・消去）を断る。画面の中では記録を使う（初期化しない）。同期もしない（`newer_local`） |
| 保存しようとする記録の schema が新しい | 保存を断る |
| 別のタブが新しい schema の記録を書いた | 保存の前に保存されている記録を確かめ、断る。以後このタブは保存しない |
| サーバーの記録が新しい schema | 合わせず、書き戻さない（`newer_remote`）。`guard.sql` を入れていれば、サーバーも schema を下げる書き込みを断る（LM003） |

**v0.22 以前のアプリはこの確認を持たない**：v0.22 の `load()` は schema が 4 以外の記録を「古い記録」とみなし、schema 4 に書き換えて保存する。
アプリ側では防げないので、**schema を 4 より上げるときは、保存先のキーも変える**（例：`lemma.v3` に移行後の記録を書き、`lemma.v2` は残す）。
こうすれば古い版のアプリは新しい記録を読まない。この決まりは `tests/store_edge.test.mjs` で検査している（`SCHEMA` を上げてキーを変えないとテストが落ちる）。

schema を上げる手順：`SCHEMA` を上げる → `MIGRATIONS` に `{ from: 旧, up }` を足す → `KEY` を変え、起動時に旧キーから読む処理を足す → `tests/store.test.mjs` に旧版の記録を足す → サーバーの記録の扱い（古い端末との同期）を決める。

## 5. バックアップと復元

書き出し（設定の「書き出す」）の形（v1）：

```json
{ "format": "lemma-backup", "version": 1, "app": "0.24.0", "schema": 4,
  "createdAt": "2026-11-23T…Z", "counts": { "log": 1234, "pstat": 300, "problems": 300, "cards": 5, "bookmarks": 3, "explains": 2 },
  "hash": "fnv1a32:xxxxxxxx", "state": { …lemma.v2 と同じ… } }
```

v1 の必須項目と検査（`readBackup`。断るときは理由と `code` を返す）：

| 項目 | 検査 | 断るときの code |
|---|---|---|
| `format` | `"lemma-backup"` | `not_lemma` |
| `version` | 1 以上の整数。`BACKUP_VERSION`（1）より大きければ断る | `bad_version` / `newer_version` |
| `state` | オブジェクト、`log` が配列、`problems` がオブジェクト | `bad_state` |
| 大きさ | 解答の記録 20万件・各表 10万件・メモ 2万字・問題ID 64字まで | `too_large` |
| `app` | 64字までの文字列 | `bad_app` |
| `schema` | 有る・1 以上の整数・`SCHEMA` 以下・`state.schema` と同じ | `no_schema` / `bad_schema` / `newer_schema` / `schema_mismatch` |
| `createdAt` | ISO 8601（UTC）で、2020年以降・未来でない | `bad_created` |
| `hash` | 有る／`fnv1a32:` ＋ 16進8桁／`stable(state)` の FNV-1a と一致、を区別 | `no_hash` / `bad_hash` / `hash_mismatch` |
| `counts` | 6項目の 0 以上の整数 | `bad_counts` |
| `counts` と実際の件数 | 違えば**注意**（記録そのものは hash で確かめ済み。付帯情報だけの食い違い） | — |
| 記録の値 | 点検（§8）でエラーが無い | `invalid_values` |

- `hash` は FNV-1a（32bit）で、**壊れた・途中で切れたファイルを見分けるためのもの**。暗号学的な改ざん防止ではない（意図して書き換え、hash も計算し直したファイルは見分けられない）。
- 含む：§1 の `lemma.v2` の全部。含まない：控え・退避・中断した演習・ログイン情報。読み込むときは `settingsAt`・`resetAt`・`localResetAt` を捨てる。
- 旧形式（v0.22 までの書き出し＝記録そのもの）も読める。付帯情報が無いので hash による確認はできない（値の点検はする）。
- v0.22 以前のアプリは v1 形式のファイルを「Lemma の学習記録のファイルではありません」として断る（読み込まないので、記録を壊さない。テストで確認）。

読み込み・控えへの復帰（`readBackup()` → `restoreState()` → `store.replace()`）：

1. 上の検査。古い schema なら移行。
2. 「合わせる」か「置き換える」。設定は今のもの。置き換えでは `resetAt` を付ける。
3. 結果を点検し、エラーがあれば取りやめる。
4. 今の記録を読む（読めなければ取りやめる）。新しい schema なら取りやめる。今の記録を控えに残す（残せなければファイルに書き出す）。
5. 保存。失敗したら本体を元の文字列に戻し、画面の記録も変えない（ロールバック）。
6. 件数の変化と点検の結果を表示する。

「記録をすべて消す」も控えを残す。「ログアウトしてこの端末だけ消す」「ログアウト時に端末の記録も消す」「アカウントの記録だけを使う」は、共用端末のため控えを残さず、**同期できたことを確かめてから**消し、`localResetAt`（§7）を付ける。

## 6. 同期（Supabase）

1回の同期（`syncOnce()`）：サーバーの行を取る → 確かめる → 手元と合わせる → 違えば `rev` つきで書き戻す（版がずれていれば取り直して最大4回）。

### 6.1 クライアント（アプリ）が保証すること

`tests/sync.test.mjs`（にせ Supabase）と `tests/server_guard.test.mjs` の後半（にせ Supabase ＋ 本物の PostgreSQL のトリガー）で確認：

- サーバーの記録の形が正しくない・新しい schema → 合わせず書き戻さない。手元の記録の形が正しくない・新しい schema → 送らない。
- 書き戻しは `rev=eq.<読んだ rev>` の条件つき PATCH。0行なら別の端末が先に書いたので取り直して合わせ直す。
- 失敗の分類（`classify()`。状態の `code`・`kind`・`halted` で画面に出す）：

| kind | 例 | 動き |
|---|---|---|
| offline | 通信できない | 15・30・60・120秒あけて自動でやり直す |
| conflict | 同時の書き込み・LM002 | 同上 |
| server | 5xx・429・408 | 同上 |
| auth | ログイン切れ・通信中のログアウト | やり直さない（ログインし直す） |
| rejected | サーバー（guard.sql）が断った LM001・LM003〜LM008 | **やり直さず、自動の同期を止める**（同じ書き込みを繰り返さない）。理由と対処を表示し、「今すぐ同期」で再開 |
| data | サーバーか手元の記録が壊れている・新しい版 | 同上 |

- 同期を同時に何度呼んでも、通信は1回分。通信中に解いた分は、反映の前に今の記録ともう一度合わせる。通信の途中でログアウトしたら、結果を手元に反映しない。
- `localResetAt` はサーバーに送らず、サーバーからも持ち込まない。

合わせ方（`mergeState`、どちらから合わせても同じ・何度合わせても同じ）：

| 項目 | 規則 |
|---|---|
| 解答の記録 | 和集合。`(p, t)` が同じものは1つにし、片方にしか無い項目は足す（項目を消さない）。切り捨てない |
| 復習状態 | 片方にしか無ければそれ。両方にあって `last` が違うとき、古い方の `last` より後の解答の記録が、新しい方の `reps` の増え方より多ければ（＝2台で別々に復習した）、古い方から記録を時刻順に `review()` し直す。そうでなければ新しい方。同じ `last` なら `reps` の多い方 |
| 解いた問題 | 最後の時刻は新しい方、回数は多い方（記録の数以上） |
| 解法カード・ブックマーク | 新しい方（ブックマークは外した印 `on:false` も残す） |
| メモ | 和集合（問題ごとに新しい5件） |
| 設定・グラフの式 | `settingsAt` が新しい方 |
| 連続日数・自己ベスト | 新しい日付の方・良い方 |
| `resetAt` | 新しい方。印の古い側からは、その時刻より前の記録を持ち込まない |
| `localResetAt` | 手元の値だけ（相手の値は持ち込まない） |

解答の記録の識別子は `(p, t)`（問題IDとミリ秒の時刻）。同じ端末では同じミリ秒に同じ問題を2回記録できないので十分。
別の端末が同じミリ秒に同じ問題を解いた場合だけ1つにまとまる（項目は足し合わされる）。端末IDを足すと、既存の記録と合わせられなくなるので足さない。

### 6.2 サーバー（`supabase/guard.sql`）が保証すること

`supabase/schema.sql` だけでは、行単位のアクセス制限（本人の行だけ）と大きさ（5,000,000 バイト未満）しか無い。
`rev`・記録の形・中身は**クライアントの約束でしかない**（古い版のアプリや、手で送られた要求は守らない）。

**v0.24 の guard.sql の不足**（v0.25 で直した）：

- 解答の記録は**件数**しか比べていなかった：同じ件数のまま別の記録に置き換える・一部を消して同じ数を足す・項目を消す、が通った。重複を足すと件数が増えるので通った。
- pstat・problems・cards・bookmarks・explains は何も確かめていなかった（全部消す書き込みも通った）。
- `resetAt` を少しでも進めれば、件数が減る書き込みがすべて通った（`resetAt` 以後の記録まで消せた）。`resetAt` を戻すことも、遠い未来にすることもできた。
- 作成（INSERT）は形しか確かめず、`rev` や schema は自由だった。schema が文字列でも通った。
- 関数が `public` にあり、Supabase の API から呼べた。

**v0.25 の規則**（破ればエラーで断り、表は変えない）：

| code | 断る書き込み |
|---|---|
| LM001 | `state` がオブジェクトでない・`log` が配列でない・解答の記録に文字列の `p` と数値の `t` が無い・pstat などがオブジェクトでない |
| LM002 | 作成で `rev` が 1 でない・更新で `rev` が「前の rev + 1」でない（重複・飛ばし・巻き戻し） |
| LM003 | `schema` が 1〜100 の整数でない（無い・文字列・小数）・更新で下げる |
| LM004 | 前にあった解答の記録（`(p, t)`）が無くなる。同じ件数での置き換え・`t` や `p` の書き換えも、元の記録が無くなるのでこれに当たる |
| LM005 | 残っている解答の記録から項目を消す（値の更新は許す：再採点の `g`・`sg`・`ok`、想起 `r`、メモ `note`、`feel`、異議 `disp`） |
| LM006 | `resetAt` が数値でない・戻す・進めるときにサーバーの時計で1日より先の未来 |
| LM007 | pstat・problems・cards（`last`）、bookmarks（`t`）の項目が消える・時刻が戻る、problems の回数 `n` が減る、問題ごとのいちばん新しいメモが消える |
| LM008 | 同じ `(p, t)` の解答の記録を増やす（作成では重複そのもの） |
| LM009 | 同じ時刻のままの書き換え（v0.26）：下の表 |
| — | `localResetAt` は送られても保存しない（取り除く） |

**同じ時刻のままの書き換え（LM009、v0.26）**。アプリの中で「時刻が同じまま値が変わる」のは pstat の再採点だけなので、それ以外は値を変えさせない：

| データ | アプリでの更新 | 許す | 断る |
|---|---|---|---|
| pstat | 復習：`last` が進み `reps+1`。再採点：同じ `last`・`reps` のまま、前の状態から計算し直す（`lapses` は ±1、S・D は大きく変わりうる）。2台の復習の計算し直し：`last`・`reps` が進む | 値が正しい範囲（S>0、1≦D≦10、reps・lapses は 0 以上の整数、lapses≦reps）で、`last` が進んだ変化／同じ `last` で `reps` が増えた変化／同じ `last`・`reps` で `lapses` の差が1まで | 範囲外の値・項目を消す／同じ `last` で `reps` を減らす／同じ `last`・`reps` で `lapses` を2以上変える |
| cards | 復習だけ（再採点しない） | `last` が進んだ変化（値が正しい範囲） | 範囲外の値／同じ `last` で `reps` を減らす／同じ `last`・`reps` で値を変える |
| bookmarks | 付け外しのたびに `{on, t: 今}` | 新しい `t` での変化（解除を含む） | 同じ `t` のまま値（`on` など）を変える |
| explains | 追加だけ（編集の画面は無い）。問題ごとに新しい5件 | メモの追加、5件から押し出された古いメモが外れる | 前にあったメモ（`t` と本文）が、押し出し以外で無くなる（LM007）／同じ `t` の別の本文に入れ替わる（LM009） |

S・D の値の大小では判定しない（再採点・計算し直しで正しく上下するため）。値が変わったかどうかは前の記録と比べ、変わっていない項目は範囲外でも断らない（guard を入れる前からの記録で同期が止まらないように）。

**守れないもの**（サーバーには「前の記録」と「新しい記録」しか見えないため）：

- `last` を進めたうえで、S・D・reps を正しい範囲の別の値にする書き込み（正しい復習・古い版のアプリの合わせ方と区別できない）。復習状態は解答の記録から計算し直せるので、解答の記録（LM004・LM005）を守ることで補っている。
- 新しく足された項目（前の記録に無い問題の pstat・新しいメモなど）の中身が正しいか。
- 解答の記録の値の書き換え（再採点で `g`・`sg`・`ok` が正しく変わるため、値は許している）。

**消してよい場合**：`resetAt` を進めた書き込み（「すべて消す」「バックアップで置き換える」）だけ、その時刻より前のもの
（解答の記録は `t`、pstat・problems・cards は `last`、bookmarks は `t`、メモは問題ごとのいちばん新しい `t`）は消えてよい。その時刻以後のものは消せない。
これはアプリの `dropBefore`（消した印の古い側から持ち込まない範囲）と同じ。

**守らないもの**（通常の操作で正しく変わるため）：settings・practice・グラフの式（最後に変えた方）、streak（日をあけると 1 に戻る）、drill の自己ベスト（良い方に入れ替わる・消去で空になる）、メモの古いもの（新しい5件に入らなければ外れる）。

**データごとの意味と規則**（アプリの中で何が起きるか → サーバーで何を許すか）：

| データ | 追加 | 更新 | 削除・解除 | サーバーの規則 |
|---|---|---|---|---|
| log | 解くたび | 再採点・想起・メモ・異議で値が変わる・項目が増える | しない（消去・置き換えのみ） | `(p,t)` が残る・項目が消えない・重複しない |
| pstat・cards | 初めて解いたとき | 復習のたびに `last` が進む | しない | 消えない・`last` が戻らない |
| problems | 初めて解いたとき | `last`・`n` が増える | しない | 消えない・`last`・`n` が戻らない |
| bookmarks | 付けたとき | 外すと `on:false` と新しい `t` | 項目は残す（外した印がほかの端末に伝わるように） | 消えない・`t` が戻らない（解除は通る） |
| explains | 書いたとき | 編集の画面は無い | 新しい5件だけ残す | いちばん新しいメモが消えない |

### 6.3 Supabase への適用手順

**guard.sql は、Supabase の SQL Editor で実行するまで効かない。** 実行は数秒で、表と既存の記録は変えない（関数とトリガーを作るだけ）。
v0.24・v0.25 の guard.sql を入れてあっても、v0.26 の guard.sql をそのまま上書きで実行すればよい（トリガーは作り直され、関数は置き換わる。テストで v0.24→v0.25→v0.26・v0.25→v0.26 を確認）。

**適用済みかの確認**（いつでも）：

```sql
select lemma_private.guard_version();   -- '0.26.0' が返れば v0.26 が入っている。v0.25 以前は「関数が無い」エラー（v0.25 は下のトリガーの確認で判別）
select t.tgname, s.nspname, p.proname from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace s on s.oid = p.pronamespace
where t.tgname = 'lemma_state_guard';   -- 0行＝未適用、public｜lemma_state_guard＝v0.24、lemma_private｜lemma_state_guard＝v0.25 以降
```

1. **適用前の確認**（何も変えない）。既存の記録に、アプリ（v0.23 以降）が読めない形のものが無いかを見る：

   ```sql
   select user_id, rev,
     jsonb_typeof(state) as state_type,
     jsonb_typeof(state -> 'log') as log_type,
     state -> 'schema' as schema,
     case when jsonb_typeof(state -> 'log') = 'array' then jsonb_array_length(state -> 'log') end as log_n,
     (select count(*) from jsonb_array_elements(case when jsonb_typeof(state -> 'log') = 'array' then state -> 'log' else '[]'::jsonb end) e
        where jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'p') is distinct from 'string' or jsonb_typeof(e -> 't') is distinct from 'number') as bad_entries,
     pg_column_size(state) as bytes
   from public.lemma_state order by bytes desc;
   ```

   `state_type` が `object`、`log_type` が `array`、`schema` が整数、`bad_entries` が 0 なら問題ない。そうでない行は、アプリ（v0.23 以降）がすでに「アカウントの記録の形が正しくない」として同期を止めている。その行は手で直す必要がある（自動では直さない。下の 5）。

2. **念のための写し**（任意・推奨。表を写すだけ）：

   ```sql
   create table public.lemma_state_backup_v026 as select * from public.lemma_state;
   alter table public.lemma_state_backup_v026 enable row level security;   -- API から見えないように（ポリシーを作らない＝誰も読めない）
   select count(*) from public.lemma_state_backup_v026;                     -- 元の表と同じ行数か確かめる
   ```

3. **適用**：`supabase/guard.sql` の中身をすべて貼り付けて実行する（v0.24・v0.25 を入れてあっても、そのまま上書きでよい）。

4. **適用後の確認**：

   ```sql
   -- トリガーが1つあり、lemma_private の関数を使っている
   select t.tgname, s.nspname, p.proname from pg_trigger t join pg_proc p on p.oid = t.tgfoid join pg_namespace s on s.oid = p.pronamespace
   where t.tgname = 'lemma_state_guard';                      -- 1行：lemma_state_guard | lemma_private | lemma_state_guard
   -- public（API から呼べる場所）に古い関数が残っていない
   select proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and proname like 'lemma_%';   -- 0行
   -- 版と、関数の権限（anon は実行できない・search_path が空・SECURITY DEFINER でない）
   select lemma_private.guard_version();                                                                   -- '0.26.0'
   select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
          p.proconfig, p.prosecdef from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'lemma_private';
   -- anon = false・authenticated = true・proconfig = {search_path=""}・prosecdef = false がすべての行で
   -- 既存の記録が変わっていない（2 の写しと比べる。0 なら同じ）
   select count(*) from public.lemma_state a full join public.lemma_state_backup_v026 b using (user_id)
   where a.state is distinct from b.state or a.rev is distinct from b.rev;
   -- 規則が効いている（変更は取り消す）：自分の行で、解答の記録を空にする更新が LM004 で断られる
   begin;
   update public.lemma_state set state = jsonb_set(state, '{log}', '[]'::jsonb), rev = rev + 1
   where user_id = (select user_id from public.lemma_state where jsonb_array_length(state -> 'log') > 0 limit 1);
   rollback;                                                   -- ERROR: lemma: 前にあった解答の記録 … （LM004）になれば効いている
   ```

   そのあと、アプリで「今すぐ同期」を押して、ふつうに同期できることを確かめる。

   **PostgREST 経由でエラーの code が返るかの確認**（テストでは確かめられない。本番の自分の行で行う）：
   アプリにログインした状態で、設定から「今すぐ同期」を押してから、ブラウザの開発者ツールのコンソールに貼り付ける。
   記録はそのまま、版番号だけを2つ飛ばして書く要求なので、**guard が効いていれば LM002 で断られ、効いていなくても rev が2進むだけ**（記録は変わらず、アプリは次の同期で取り直す）：

   ```js
   const { SUPABASE_URL: U, SUPABASE_KEY: K } = await import('./js/config.js');
   const a = JSON.parse(localStorage.getItem('lemma.auth'));
   const h = { apikey: K, Authorization: `Bearer ${a.access_token}`, 'Content-Type': 'application/json' };
   const [row] = await (await fetch(`${U}/rest/v1/lemma_state?select=state,rev&user_id=eq.${a.user.id}`, { headers: h })).json();
   const r = await fetch(`${U}/rest/v1/lemma_state?user_id=eq.${a.user.id}&rev=eq.${row.rev}`,
     { method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ state: row.state, rev: row.rev + 2 }) });
   console.log(r.status, await r.text());
   ```

   期待：`400 {"code":"LM002","message":"lemma: rev は … のはずです …"}`。
   `200` で行が返ったら guard が効いていない（SQL の適用を確かめる）。`401` ならログインの期限切れ（「今すぐ同期」を押してからもう一度）。
   アプリの表示は `code` を見て日本語の理由を出すので、ここで `code` が `LM002` として返ることが、アプリが正しく理由を出せることの確認になる。

5. **形の崩れた行がある場合**（1 で見つかったとき）：その利用者に設定から書き出してもらう（端末の記録は残っている）。行は消さず、写し（2）を取ったうえで、どの部分が崩れているかを見てから直す。トリガーを一時的に外す必要がある場合は、作業のあと必ず戻す：

   ```sql
   alter table public.lemma_state disable trigger lemma_state_guard;
   -- （直す update）
   alter table public.lemma_state enable trigger lemma_state_guard;
   ```

**戻し方**（制限を外す。記録は変えない）：`drop trigger if exists lemma_state_guard on public.lemma_state;`
写しの表は、確認が済んだら `drop table public.lemma_state_backup_v026;` で消してよい（消さなくても API からは見えない）。

**適用後に同期できなくなる利用者**：

| 利用者 | 理由 | 対処 |
|---|---|---|
| v0.22 以前のアプリで、解答の記録が5000件を超えた人 | 切り捨てて書き戻す（LM004） | アプリを更新する（再読み込み） |
| 端末の時計が1日以上進んだ状態で「すべて消す」をした人 | LM006 | 端末の日時を直してから、もう一度「すべて消す」→「今すぐ同期」 |
| サーバーの行の形が崩れている人 | v0.23 以降のアプリはすでに同期を止めている | 上の 5 |

### 6.4 PGlite で確かめたこと・実際の Supabase でしか確かめられないこと

`tests/server_guard.test.mjs` は、PostgreSQL 18（PGlite：WASM 版）に schema.sql の表（`auth.users` への参照と RLS を除く）と guard.sql を入れて確かめる：

- 上の規則のすべて（作成・更新・resetAt・各データ・同じ時刻のままの書き換え）と、通るべき書き込み（追加・再採点・想起・メモ・メモの押し出し・ブックマーク解除・設定・全消去・置き換え・resetAt 以前だけの削除・2台の復習の計算し直し）
- 本物の `js/sync.js` と `js/store.js` が、トリガーつきの表を相手に、2台での追加・同時更新・2台での復習・ネットワーク障害と再試行・全消去・古い端末からの復活防止・バックアップの置き換えと合わせる読み込み・ログアウトして消した端末の同期・5000件超・断られた後の停止と再開、をすべて通ること
- `authenticated`・`service_role` の権限でトリガーが動き、`anon` は関数を実行できないこと。関数の search_path が空で、SECURITY DEFINER を使っていないこと
- v0.24→v0.25→v0.26・v0.25→v0.26 の上書き適用で、既存の記録が変わらず、トリガーが1つだけで、新しい規則が効くこと
- 2万件の記録の更新を確かめられること（PGlite で数秒以内）

実際の Supabase でしか確かめられないこと：

- guard.sql を実行したこと（上の 4 の確認）
- PostgREST が、トリガーのエラーを HTTP 400 と `{ code: "LM00x", message }` で返すこと（アプリはこの形を前提にしている。確かめ方は 4）
- RLS・認証と組み合わせた動き、本番の大きさの記録でのトリガーの時間（Supabase の文の時間制限）
- 本番の既存の記録が、上の 1 の確認を通ること

## 7. 同じ端末の複数のタブ

- 保存のたびに、保存されている記録がこのタブの最後に読み書きしたものと違えば、合わせてから書く（§2）。書いた直後に別のタブが書いた場合も、読み返しで気づいて合わせ直す。
- 別のタブが保存すると `storage` イベントで知り、すぐ合わせる（解いている途中でなければ画面を描き直す）。
- 合わせ方は `mergeTabs`：同期の `mergeState` に加えて、**`localResetAt`**（この端末で「置き換えた」時刻。同期しない）より前の記録を、印の古い側から持ち込まない。
- 置き換え・消去と、古いタブの保存：
  - 「すべて消す」「バックアップで置き換える」は `resetAt` を付ける → 古いタブの、その時刻より前の記録は戻らない（後に解いた記録は残る）
  - 「ログアウトして端末の記録を消す」「アカウントの記録だけを使う」は `localResetAt` を付ける（`resetAt` はサーバーに伝わってサーバーの記録まで消すため使わない）→ 同じく戻らない
  - 「今の記録と合わせる」読み込みは印を付けない（和集合）
- 別のタブが新しい schema に移行した記録は上書きしない（§4）。別のタブが壊れた記録を書いていたら退避してから書く。
- 合わせても同じなら書かない。同じ保存を繰り返しても記録は増えず、タブどうしで書き込みが行ったり来たりしない。
- 合わせ直しが4回で収まらなければ止め（`conflict`）、画面の記録は残す。

localStorage には複数のタブにまたがるロックが無いため、「読む→書く」の間に別のタブが書くことは防げない。上の読み返しと、次の保存での合わせ直しで、記録が失われないようにしている（失われうる場面は §10）。

## 8. 整合性の点検

`audit(state, { problemIds, cardIds, now })` → `{ errors, warnings, stats }`。各項目に `code`・説明・対象のID（最大50）・件数・`fix`（`auto`＝`repair()` で安全に直せる／`human`＝人が判断）。

| 区分 | code |
|---|---|
| エラー | `bad_container` `bad_log` `bad_schema` `log_bad_time`（2020年より前）`log_bad_grade` `log_bad_recall` `pstat_invalid`（S≦0、D が1〜10の外、lapses>reps など）`card_invalid` `problems_invalid` `bookmark_invalid` `explain_invalid` `reset_invalid` `settingsat_invalid` |
| 注意（auto） | `log_duplicate` `log_unsorted` `problems_behind_log` |
| 注意（human） | `log_unknown_problem` `pstat_unknown_problem` `bookmark_unknown_problem` `card_unknown`（今のデータに無いID）`log_future` `reset_future` `log_bad_kind` `streak_invalid` `schema_newer` |

`repair()` は削除しない：重複した解答の記録の統合（項目は足すだけ）・時刻順の並べ替え・解いた回数の引き上げだけ。
アプリは自動では直さない（点検の結果を設定に表示するだけ）。

使い方：

```
node tools/audit_state.mjs lemma-2026-11-23.json             # 点検（エラーがあれば終了コード 1）
node tools/audit_state.mjs lemma-2026-11-23.json --json      # JSON で
node tools/audit_state.mjs lemma-2026-11-23.json --fix 直した.json   # 安全な修復をした新しいファイル（元は変えない・既存のファイルは上書きしない）
```

10万件の記録の点検は1秒未満（`tests/store.test.mjs` で確認）。

## 9. 保存容量（localStorage）

実測（`tests/golden/ids.txt` の問題に、実際の形の解答の記録を入れて JSON の文字数を数えた）：

| 解答の記録 | 本体の大きさ |
|---|---|
| 1,000件 | 約24万文字 |
| 5,000件 | 約118万文字 |
| 10,000件 | 約178万文字 |
| 20,000件 | 約291万文字 |
| 30,000件 | 約403万文字 |

解答1件 約110文字＋問題ごとの復習状態・解いた回数 約120文字（問題数 5,278 で頭打ち、約65万文字）。
localStorage の上限は多くのブラウザでオリジンあたり約500万文字（Safari・Chrome・Firefox。正確な値はブラウザと版による。実機では確かめていない）。

- 1日8問（今日のセットの既定は6問）なら1年で約3,000件 → 上限まで10年以上。1日30問でも1年で約1万1千件 → 約3年。
- 控え（最大2件）は本体と同じ大きさ。v0.24 からは、本体を保存する場所が足りなければ控えを古い方から捨てる（本体を優先）。
- Supabase の行の上限（`pg_column_size(state)` 5,000,000 バイト未満。jsonb は圧縮されうる）も同じくらいの大きさなので、端末だけ IndexedDB にしても、同期する人の上限は変わらない。

判断：**今は IndexedDB に移さない**。典型的な利用では数年以上余裕があり、移行（非同期の読み書き・複数タブの扱い・旧データの移し替え・同期の行の分割）の実装リスクの方が大きい。
代わりに、本体が300万文字を超えたら1回知らせ（書き出しを勧める）、設定の「記録の点検」に保存している量を表示し、容量不足では控えを先に捨て、それでも入らなければ前の記録を残して知らせる。

移す必要が出たときの段階的な計画（未着手）：
1. 読み書きを `createStore` の中に閉じたまま、IndexedDB 版の保存先を作る（`load/save/replace` の約束は同じ。非同期になる）。
2. 起動時に IndexedDB に記録が無ければ `lemma.v2` から写し、写したことを確かめてから使う。`lemma.v2` は消さずに残す（古い版のアプリ用・戻すとき用）。
3. 解答の記録を年ごとなどに分けて持ち、同期も分割（サーバーの行を分ける）。サーバー側の移行が必要。

## 10. 分かっている制約・残るリスク

- **v0.22 以前のアプリ**：新しい schema の記録を書き換えてしまう（§4 の決まりで避ける）。同じアカウントで同期すると、5000件での切り捨て・復習状態は新しい方だけ、で書き戻す。`guard.sql` を入れれば切り捨ては断られるが、復習状態の取りこぼしはサーバーでは見分けられない。全端末を更新する必要がある。
- **guard.sql は Supabase に入れるまで効かない**（§6.3）。実際の Supabase（PostgREST 経由）では確かめていない。トリガーが確かめられるのはサーバーの前の記録との比較だけなので、記録の中身が正しいか（例：復習状態の値が解答の記録と合っているか）までは見ない。
- 古い版のアプリの復習状態の合わせ方（新しい方だけ）による取りこぼしは、サーバーでは見分けられない（`last` は戻らないため）。
- `resetAt` は端末の時計で付ける。時計が遅れた端末で消すと、ほかの端末で「消した時刻」以後に解いた記録の一部が残る（消しすぎることはない）。時計が1日以上進んだ端末の消去はサーバーが断る（1日以内なら、その分だけ未来の記録まで消える範囲が広がる）。
- localStorage には複数タブにまたがるロックが無い。読み返した後に別のタブが（このタブの記録を知らずに）書くと、このタブの記録はいったん保存先から外れる。このタブの次の保存（または `storage` イベント）で合わせ直すが、その前にこのタブが閉じられると、その分は失われる。
- 「置き換え」「すべて消す」の時刻より前に別のタブで解き、まだ保存していなかった記録は、置き換えに合わせて持ち込まない（解いた直後に保存するので、実際の間は短い）。
- 新しい schema の記録を読んだ古いアプリでは、解いた結果が保存されない（記録を守るため）。
- 端末の時計が大きくずれていると、`last`・`settingsAt`・`resetAt`・`localResetAt` の比較が狂う（未来の時刻は点検で注意になる）。
- バックアップの `hash` は改ざん防止ではない。
- Safari は7日以上開かないとサイトの保存領域を消すことがある（ホーム画面に追加すると対象外）。アプリでは防げない。
- 容量の上限・プライベートモードの挙動は、実機のブラウザでは確かめていない（テストは保存先の失敗を再現したもの）。
