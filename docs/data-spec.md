# Lemma データ仕様（v0.8）

問題データは「Excel（マスター）→ 正規データ `content/` → アプリ用データ `data/`」の2段で作る。
アプリが読むのは `data/` だけで、その形は v0.6 までと同じ。`content/` は LaTeX のままの正規データで、
検索・問題セット・教材化・AI 処理の土台にする。JSON Schema は `tools/schema/`。

```
Lemma問題管理表.xlsx（手元のみ。参考元を含むので公開リポジトリに置かない）
   │ tools/xlsx_to_content.py   … 非公開の列（参考元・メモ）はここで捨てる
   ▼
content/                       … 正規データ（公開・git で差分を見る）
   taxonomy.json  methods.json  meta.json  tags.json  collections/*.json
   problems/<分野ID>.json  problems/builtin.json
   │ tools/build_app_data.py
   ▼
data/                          … アプリ用（index.json・f-<分野ID>.json・search.json・collections.json）
```

ふだんは `python3 tools/import_xlsx.py Lemma問題管理表.xlsx` で 1〜3 をまとめて行い、`node tests/run.mjs` で検査する。

## ID の規則

| ID | 形 | 規則 |
| --- | --- | --- |
| 問題ID | `III-INT-001`（管理表）、`q01`（内蔵） | 一度使ったら変えない・再利用しない。接頭辞は採番の目安で、分野を移しても ID はそのまま（分野は `field` で持つ）。`q`＋数字は内蔵問題専用 |
| 分野ID | `I-01` 〜 `X-20` | `content/taxonomy.json` で固定。管理表の「分野一覧」シートの並びとは無関係。新しい分野は `--new-fields` で末尾の番号を足す。消すときは `retiredNumbers` に番号を残し、再利用しない |
| 解法ID | `qe-loc` | 英小文字とハイフン。内蔵の解法カード（CARDS）の ID をそのまま使う |
| 問題セットID | `col-kiso-quadratic` | `col-` で始まる英小文字とハイフン |

問題ID がすべて残っていることは `tests/golden/ids.txt` で検査する（消えると CI が失敗）。

## 問題（`content/problems/*.json` の各要素、`lemma.problem/1`）

| 項目 | 必須 | 内容 | 管理表の列 |
| --- | --- | --- | --- |
| `id` | ○ | 問題ID | A：ID |
| `schema` | ○ | `"lemma.problem/1"` | — |
| `kind` | ○ | `written`（管理表）／`interactive`（内蔵） | — |
| `field` | ○ | 分野ID | C：科目＋D：分野（taxonomy.json で引く） |
| `level` | ○ | 0=基礎 1=標準 2=2次基礎 3=国立2次 4=難関 5=最難関 | F：難易度（数でなければ 3 にして `quality.issues` に `level-missing`） |
| `minutes` | | 想定時間（分） | G |
| `theme` `unit` `topic` | | 「単元・テーマ」そのまま、と「／」で分けた前後 | E |
| `statement.tex` | ○ | 問題文（LaTeX） | H |
| `answer.tex` | ○ | 答え（LaTeX） | I |
| `solutions[]` | ○ | `{id:"main", kind:"main", tex}`。別解は `alt1`… | J：解答・解説 |
| `idea.tex` | | 核となるアイデア | K |
| `grading` | | `{format:"lemma-input/1", spec}`（入力用の答え。書式は管理表の「使い方」シート）／内蔵は `{format:"builtin/1", type, ans, vars, choices}` | T |
| `hints[]` | | 内蔵問題の3段階ヒント | — |
| `methods[]` | ○ | 解法ID（今は内蔵問題だけ。空でよい） | — |
| `tags[]` | ○ | タグ（「非表示」は除く） | R |
| `provenance` | ○ | `{created: "YYYY-MM-DD"}`（作成方法は公開しない設定。`xlsx_to_content.py` の `INCLUDE_METHOD`） | B（M は既定で入れない） |
| `quality` | ○ | `{status, checks:{dual,sympy,human}, verified, issues?}`。`status` は `published`／`hidden`（タグに「非表示」）など | N・O・P・Q・R |
| `assets` | | 内蔵問題のグラフ（`graph` `graph3` `view`） | — |

**入れない列**：L「参考元（非公開）」、S「メモ」。`python3 tools/audit_data.py --xlsx 管理表.xlsx` で、
これらの文字列が公開ファイル（content/・data/・js/）に無いことを確かめられる。

## 分類（`content/taxonomy.json`、`lemma.taxonomy/1`）

`fields[]` = `{key, subject, name, idPrefix, order}`。`builtinUnits` = 内蔵問題の単元（`i-quad` など）→ 分野ID。
`order` が画面の並び順。分野を統合して ID が無くなるときは `replacedBy` に移り先を書く（アプリ側の読み替えは未実装）。

## タグ辞書（`content/tags.json`、`lemma.tags/1`）

`tags[]` = `{name, aliases?, count}`。`name` が正規名、`aliases` が同じ意味の別の表記。表記ゆれ（中黒・空白・全角半角）は
比較のときに無視する（`tools/tags.py` の `norm()`。アプリの `normText()` も同じ規則）。
問題の正規データのタグは Excel の表記のままで、**アプリ用データを作るときに正規名に置き換える**。
取り込みのたびに `tools/tags.py` が新しいタグを足す（既存の項目・人が足した別名は消さない）。

## 問題セット（`content/collections/<ID>.json`、`lemma.collection/1`）

`{id, title, description?, level?, order?, items:[{id, note?}], visibility, createdBy}`。ファイル名＝`id`。
`items` の並びが出題順で、アプリは「まだ解いていない問題から順に」出す。非公開の問題・無い問題はアプリ用データから外れる。
共有リンク：`#set=<セットID>`、`#ids=<問題ID,問題ID,…>`（最大50問）、`#search=<言葉>`。

## 検索用の索引（`data/search.json`）

`{dataVersion, items:[[問題ID, 文字列], …]}`。文字列はテーマ・分野名・タグ（正規名と別名）・問題文の文章部分
（数式は sin・log などの関数名だけ残す）を `norm()` で正規化して連ねたもの。アプリは初めて検索したときに読む。

## アプリ用データ（`data/`、`lemma.data/1`）

v0.6 と同じ項目に、次を足しただけ（古いアプリは無視する）。

- `index.json`：`format`（`"lemma.data/1"`）、`dataVersion`（`content/` の中身から計算する12桁）、`builtinUnits`
- `f-*.json`：`"_meta": {"dataVersion"}`。`index.json` と違えば、アプリは「問題データの版が揃っていません」と表示する
- `search.json`・`collections.json`：上記。どちらも `dataVersion` を持つ
- `dataVersion` は taxonomy・problems・tags・collections の中身から計算する

## オフライン（Service Worker、`sw.js`）

| キャッシュ | 中身 | 入れ替え |
| --- | --- | --- |
| `lemma-v<版>` | コード（HTML・JS・CSS・KaTeX） | `VERSION` を上げると古いものを消す |
| `lemma-data-<dataVersion>` | `data/` のファイル（開いた分野の本文・検索の索引など） | `data/index.json` を取り直して版が変わったら、古いデータ用キャッシュを丸ごと消す |

どちらも「まずネットワーク、つながらなければキャッシュ」。オフラインでは、一度開いた分野の問題が解ける。

## 版は3つを分ける

| 版 | 場所 | いつ上げるか |
| --- | --- | --- |
| コードの版 | 各 JS の `FILE_VERSION`、CSS の `--lemma-version`、`sw.js` の `VERSION` | アプリを更新したとき（食い違うと赤い警告） |
| データ形式の版 | `index.json` の `format` | `data/` の項目の意味を変えたとき（アプリは知らない形式に警告を出す） |
| 学習記録の版 | localStorage `lemma.v2` の `schema`（今は 4） | 学習記録の形を変えたとき。データの形を変えても上げない |

## 変えるときの決まり

1. 移行（形の変更）と、問題の中身の修正は別々に行う。形を変えたら `python3 tools/compare_data.py 旧data 新data` で差 0 件を確かめる。
2. 戻すとき：`data/` は生成物なので、前の `data/` を置き直せば戻る。`python3 tools/import_xlsx.py 管理表.xlsx 出力先 --legacy` で v0.6 までの方法でも作れる。
