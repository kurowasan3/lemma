# 解説の敵対的再検証（第2パス）手順

あなたは，保存済み解説の「粗探し」担当です。第1パスの検証者は多くの小問を A（正確）と判定しましたが，それが甘い判定でないかを確かめるのが役目です。

## 入力

- 担当の問題IDリスト（依頼文に書いてある）
- 問題文：`/tmp/expl-indep/batches/batch_*.md`（担当IDを含むファイル）
- 保存済みの答え・解説：`/tmp/expl-cmp/stored/batch_*.md`
- 凍結済み独立解答：`/tmp/expl-indep/out/batch_*.md`（参考。正しいとは限らない）

**第1パスの判定（`/tmp/expl-cmp/out/` 以下）は見ない。** 先入観を避けるため。リポジトリ `/home/claude/lemma` も開かない。資料は書き換えない。

## やり方

各小問について，保存済み解説を一文ずつ読み，次の各点を「自分で書き出して」確かめる。

1. 各式変形・各計算（スクリプトで記号計算・数値検算してよい：`/tmp/expl-cmp/work/redteam_RR/`，`python3 -I`）
2. 主張ごとに：それは前提から本当に出るか，どこで何の定理を使っているか
3. 必要条件と十分条件：求めた範囲・集合が「必要」だけでなく「十分」も示されているか（逆の確認）
4. 場合分けの漏れ，境界値・等号・端点・退化ケース，分母0・定義域
5. 「明らか」「同様に」で飛ばしている箇所が本当に自明か
6. 有限個の例・数値で一般の主張を済ませていないか
7. 存在と一意性の両方が必要なら両方示しているか

**A にしてよいのは，上の確認をすべて書き出して問題がなかったときだけ。** 1つでも根拠のない飛躍があれば B 以下。確信が持てなければ E。

分類は `/tmp/expl-cmp/INSTRUCTIONS.md` の A〜E と同じ定義を使う（解法が独立解答と違うだけ，説明が短いだけでは減点しない）。

## 出力

`/tmp/expl-cmp/redteam/redteam_RR.csv`（ヘッダ付き）：

```
problem_id,subproblem,explanation_category,weakest_point,issue_description,correction_proposal,confidence,human_review_required
```

- subproblem：`(1)` 形式，小問なしは `全体`。担当問題の全小問を書く。
- weakest_point：その解説でいちばん弱い箇所（A でも必ず書く。150字以内）。
- issue_description：B〜E の理由を具体的に。

`/tmp/expl-cmp/redteam/redteam_RR_notes.md` に，各小問で確かめた点（上の1〜7）を簡潔に記録する。

終わったら，出力パスと，B〜E の小問の一覧だけを短く報告する。
