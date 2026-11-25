# 人手レビュー資料の索引

| 小問 | 問題ファイル | 論点の種類 | 第一段階 | 解説監査（第1／第2／最終） | PR #3 での変更 | 機械検算 | 状態 |
|---|---|---|---|---|---|---|---|
| [II-TRI-190 (1)](human_review_guide.md#ii-tri-190-1) | `content/problems/II-10.json` | 数学（確認のみ） | B | A／A／A | なし | ✓ | 未審査 |
| [II-TRI-190 (2)](human_review_guide.md#ii-tri-190-2) | `content/problems/II-10.json` | 数学（境界） | D | A／A／A | なし | ✓ | 未審査 |
| [II-TRI-190 (3)](human_review_guide.md#ii-tri-190-3) | `content/problems/II-10.json` | 数学（境界） | D | A／A／A | なし | ✓ | 未審査 |
| [III-DIF-356 (2)](human_review_guide.md#iii-dif-356-2) | `content/problems/III-16.json` | 出題意図 | 判定不能 | A／A／A | なし | ✓ | 未審査 |
| [III-DIF-374 (2)](human_review_guide.md#iii-dif-374-2) | `content/problems/III-16.json` | 数学（修正の正しさ） | 判定不能 | D／A／D | 解説・着想 | ✓ | 未審査 |
| [A-COM-510 (2)](human_review_guide.md#a-com-510-2) | `content/problems/A-05.json` | 表記（裁定の妥当性） | 判定不能 | A／A／C | なし | ✓ | 未審査 |
| [B-SEQ-342 (1)](human_review_guide.md#b-seq-342-1) | `content/problems/B-13.json` | 表記（記号） | C | C／A／C | 解説・着想 | ✓ | 未審査 |
| [B-SEQ-342 (2)](human_review_guide.md#b-seq-342-2) | `content/problems/B-13.json` | 表記（記号） | A | C／A／C | 解説・着想 | ✓ | 未審査 |
| [B-SEQ-342 (3)](human_review_guide.md#b-seq-342-3) | `content/problems/B-13.json` | 表記（記号） | A | C／A／C | 解説・着想 | ✓ | 未審査 |
| [C-CUR-459 (1)](human_review_guide.md#c-cur-459-1) | `content/problems/C-19.json` | 出題意図（答えに影響） | 判定不能 | A／B／B | 解説 | ✓ | 未審査 |
| [II-GEO-300 (2)](human_review_guide.md#ii-geo-300-2) | `content/problems/II-09.json` | 表記（補足の要否） | A | A／B／B | 解説 | ✓ | 未審査 |
| [III-DIF-359 (1)](human_review_guide.md#iii-dif-359-1) | `content/problems/III-16.json` | 数学（修正の正しさ） | 判定不能 | A／C／C | 解説 | ✓ | 未審査 |
| [III-DIF-380 (2)](human_review_guide.md#iii-dif-380-2) | `content/problems/III-16.json` | 答えの書き方 | C | C／B／B | 答え・解説 | ✓ | 未審査 |

## このフォルダのファイル

| ファイル | 内容 |
|---|---|
| `human_review_guide.md` | 13小問それぞれの A〜F（問題文，登録内容と修正前後，監査の指摘，独立した検証，判断の論点，判定欄） |
| `human_review_checklist.md` | 審査者が記入するチェックリスト |
| `review_index.md` | この索引 |
| `review_notes.py` | 手書き部分（C の注記，D，E） |
| `verify.py` / `verify_results.json` | 機械による検算とその結果 |
| `build.py` | 資料の生成と自己点検 |

## 参照した記録（読むだけで変更していない）

- 第一段階の集計：`71c8a7d:docs/audit/2026-11-25/aggregate-254/subproblem_summary.csv`
- 解説監査：`500b033:docs/audit/2026-11-25/explanation-audit/explanation_results.csv`
- 凍結された独立解：`f4f6db86:docs/audit/2026-11-25/explanation-audit/independent_solutions.md`
- 修正段階：`docs/audit/2026-11-25/explanation-remediation/remediation_results.csv`，`human_review_required.md`，`before_after.md`
- 最終検証：`docs/audit/2026-11-25/final-validation/human_review_status.md`（13小問すべて「確認待ち」のまま）

## 記録の食い違い（この資料で気づいたもの）

- II-TRI-190 (1)：`human_review_required.md` は「第一段階でD」と書くが，集計では (1) は B（人手確認「いいえ」）で，D は (2)(3)。問題単位の D により (1) も対象になったものと考えられる。既存の記録は書き換えていない。
