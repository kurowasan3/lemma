# 保存済み解説の検証手順（解説監査・第2段階：照合）

あなたは、大学受験数学の問題の「保存済みの答え・解説」が数学的に正しく、論理的に完結し、受験生が再現できるかを検証する担当です。

この段階では、独立解答（保存済み解説を見ずに別の担当が作り、Gitで凍結済み）と保存済み解説の両方を読んでよい。

## 入力（担当バッチ NN）

- 問題文：`/tmp/expl-indep/batches/batch_NN.md`
- 独立解答（凍結済み）：`/tmp/expl-indep/out/batch_NN.md`
- 保存済みの答え・解説：`/tmp/expl-cmp/stored/batch_NN.md`
- 第一段階の小問分類：`/tmp/expl-cmp/first_audit.csv`（列 id, subproblem, category）

リポジトリ `/home/claude/lemma` は**開かない**。上の資料だけで判定する。どの資料も**書き換えない**。

## やること

各小問について、保存済み解説の該当部分を**一行ずつ検証**する。もっともらしく見えるかではなく、各式変形・各主張を自分で確かめる。必要なら `/tmp/expl-cmp/work/batch_NN/` でスクリプトを書いて検算する（`python3 -I`）。

1. 最終答案：独立解答と一致するか。食い違えば、どちらが正しいかを自分で決着させる（独立解答が誤りのこともある）。
2. 解法の方針が成り立つか。
3. 計算・変形が正しいか（係数・符号・定義域・分母0）。
4. 論理：必要・十分の向き、同値変形、逆向きの確認、存在と一意性、有限個の例で一般を済ませていないか。
5. 条件・場合分けの網羅。
6. 境界・退化・例外点。
7. 受験生が読んで再現できるか（必要な論理が省略されていないか。短いだけでは減点しない）。

証明の小問は、保存済み解説の**論証そのもの**を検証する。結論が正しくても論証が不完全ならAにしない。

## 分類（explanation_category）

- A：正確。数学的に妥当で，論証・計算に重大な問題がなく，必要な説明もある。
- B：結論は正しいが，説明不足・論理の飛躍・補足が必要な箇所がある。
- C：軽微な誤記・表記ミス・説明上の不備があるが，数学的な結論や論証の本質は損なわれていない。
- D：数学的な誤り，誤った論証，重要な条件の欠落，場合分けの漏れなどがある。
- E：資料不足・問題文の曖昧さなどにより検証を完了できない。

注意：解法が独立解答と違うだけで減点しない。数値計算を使っただけでDにしない。確信が持てないときは無理にAにせずEにし，human_review_required を「はい」にする。保存済み解説の方が独立解答より優れている場合はそう書く。

各観点の欄（mathematical_correctness, logical_validity, calculation_accuracy, condition_coverage, boundary_case_coverage, reproducibility）は「OK / 問題あり / 該当なし / 未確認」のいずれかで書く。

## 出力

`/tmp/expl-cmp/out/batch_NN.csv`（UTF-8，ヘッダ付き，カンマ区切り，必要ならダブルクォート）。1行1小問，バッチ内の全小問を漏れなく：

```
problem_id,subproblem,independent_answer,stored_answer,stored_explanation_excerpt,final_answer_match,explanation_category,mathematical_correctness,logical_validity,calculation_accuracy,condition_coverage,boundary_case_coverage,reproducibility,numeric_dependence,confidence,issue_description,correction_proposal,human_review_required
```

- subproblem：`(1)` 形式，小問がなければ `全体`（第一段階CSVと同じ表記）。
- independent_answer / stored_answer：最終答案を短く（200字以内）。
- stored_explanation_excerpt：該当箇所の短い引用（150字以内）。問題点があればその箇所を引用。
- final_answer_match：一致 / 同値（表記差）/ 不一致 / 該当なし（証明）。
- numeric_dependence：なし / 補助のみ / 結論が依存（保存済み解説が数値計算・有限探索に頼っているか）。
- confidence：高 / 中 / 低（あなたの判定の確信度）。
- issue_description：B〜E のときは具体的に（どの式・どの主張がなぜ問題か）。A なら空でよい。
- correction_proposal：修正案（原本は直さない。ここに書くだけ）。
- human_review_required：はい / いいえ。

あわせて `/tmp/expl-cmp/out/batch_NN_notes.md` に，D・E と判定した小問，独立解答と保存済み答案が食い違った小問について，検証の過程（自分で確かめた計算・反例など）を書く。

終わったら，出力パスと，D・E の小問の一覧だけを短く報告する。
