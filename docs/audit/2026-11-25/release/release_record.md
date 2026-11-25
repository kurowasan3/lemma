# PR #3 反映の記録（2026-11-25）

PR #3（解説修正 9問11小問）を，同期済み管理表を正本として main にマージした作業の記録。

## 結果

| 項目 | 結果 |
|---|---|
| マージ | PR #3 を merge commit でマージ（`3b5718df3dc89900d0d90551f5f386a4d7a1e07b`，2026-11-25 21:04 JST）。PR #3 の head `90c0794b` をそのまま残すため，履歴を書き換える squash・rebase は使っていない |
| main の木 | マージ後の main の木（`9c9c2395…`）は PR #3 head の木と同じ |
| 公開サイト | GitHub Pages（https://kurowasan3.github.io/lemma/）への `3b5718d` の配置は GitHub 上で success（21:05 JST）。Cloudflare Pages への配置は設定がないので CI が skip（従来どおり）。**サイトを開いての表示確認はできていない**（この作業環境からサイトに接続できない） |
| CI（マージコミット） | test（`node tests/run.mjs --e2e`）success |

## 1. 作業前の状態

| 項目 | 確認した値 |
|---|---|
| main | `c3193afacdceeece990b9c4ef99046f9b94b0285` |
| PR #3 | draft，head `90c0794b741a80601ec05d042f15ba69bff8acca` → main，CI test success，mergeable clean |
| PR #4 | draft，head `f746e69205d153cba703a89f65587e73f7b4fcb3` → PR #3 のブランチ |
| PR #5 | draft，head `5e655b19e364f0b456458a58863df33d57436bb8` → PR #4 のブランチ |
| 作業ツリー | clean |

## 2. 管理表（Excel）

| ファイル | SHA-256 | 大きさ |
|---|---|---|
| 原本（バックアップ，読み取り専用） `Lemma問題管理表_v0.29.3_原本_20261125-202026_main-c3193af.xlsx` | `b381fbbac257db1254f0ca7b38f9f9e7c684140d2b6a4036148f4d78df17a8b3` | 5,796,885 |
| 同期済み（正本） `Lemma問題管理表_v0.29.3_解説修正反映_PR3.xlsx`（作業環境では `Lemma問題管理表.xlsx` としても配置） | `ce322fab5079dbd90afccc026df6ba863f9a1c37be2487472f0b43a9593759e0` | 5,797,921（作成 2026-11-25 20:24 JST） |

正本は Mitoka の PC にある。PC の管理表を同期済みファイルに差し替えたことは，マージ前に Mitoka が確認した（作業環境からは PC のファイルに触れられない）。管理表はリポジトリに入れていない（参考元を含むため）。

`check_xlsx.py` による比較（結果は `xlsx_check.json`）：

- zip の部品：18 / 18，増減なし。違うのは `xl/worksheets/sheet2.xml`（問題一覧）だけ。書式（styles）などほかの部品はバイト単位で同じ
- シート：4枚（使い方・問題一覧・分野一覧・弟テスト記録），名前・順序・範囲（問題一覧 A1:V5472 など）は同じ。原本の数式セル 6454 個も変化なし
- 全シート全セルの比較：違うセルは **12**。すべて問題一覧の「答え」「解答・解説」「核となるアイデア」で，PR #3 で変わった欄の集合（12）と一致。12セルとも値が PR #3 の JSON と完全一致
- 問題 ID：5471行，重複なし（content の 5532問は，管理表の 5471問と組み込み問題 q01〜q61 の和）

## 3. 正本からの再生成（一時的な作業ツリー，PR #3 head）

`python3 tools/import_xlsx.py Lemma問題管理表.xlsx` を実行：

- 変わったファイルは `content/meta.json` と `data/index.json` の2つだけで，違いはどちらも取り込み元のファイル名（source）と生成日時（generated）だけ
- content/problems と data/f-*.json・search.json などは PR #3 と完全一致。dataVersion `0acf91f3206e`（main の旧 `a6e4017a4fd4` から更新），問題数 5470（表示），ID 重複なし
- 参考：原本で取り込むと 31 ファイルが PR #3 前に戻る。正本の差し替えが必要な理由

マージ後の main でも同じ取り込みをして，同じ結果（meta の2項目以外一致）を確かめた。

## 4. PR #3 の差分

- 55 ファイル：content/problems 6，data 24，`docs/audit/2026-11-25/explanation-remediation/` 25。それ以外なし
- content：変わった欄は 9問 12欄（答え1，解説9，着想2）だけ。問題文・ID・並び・難易度・タグ・分類・品質データの変更なし。問題数 5532 → 5532
- data：違いは上の 12欄（a/s/k）と，全ファイルの dataVersion だけ

## 5. テスト（`tests.txt`）

`node tests/run.mjs`（PGlite を入れた状態）：main（マージ前） 25/25，PR #3 25/25，main（マージ後） 25/25。項目と結果は3つとも同じ。
PGlite がない状態では「サーバー側の書き込み制限」1件が以前から失敗する（環境依存。main と PR #3 で同じ）。
B-SEQ-342 の記号付け替えの回帰テスト（`final-validation/symbol_replace.py`）は字句解析版がすべて合格。

## 6. PR #4・PR #5

マージしていない。どちらも draft のままで，差分は監査資料だけ（PR #4：`final-validation/` 9ファイル，PR #5：`human-review/` と本記録）。main には入っていない。

## 未解決

- 公開サイトで修正対象の問題を開いての表示確認（TeX の描画は `check_katex.cjs` と CI の e2e では合格）
- PR #4・PR #5 を main に入れるかどうか（入れるなら別途確認のうえ）
