#!/usr/bin/env python3
"""LaTeX を含む文章で，添字つきの記号（例：b_n）だけを別の記号に付け替える関数と，その回帰テスト。

B-SEQ-342 の修正で，正規表現 (?<![A-Za-z\\])b_ が「d_mb_n」の b_n（前が英字 m）を取りこぼした。
ここでは LaTeX の命令名（\\ の後の英字列）を読み飛ばす字句解析で付け替える。

    python3 docs/audit/2026-11-25/final-validation/symbol_replace.py      # テストを実行（失敗があれば終了コード1）
"""
import re, sys

def rename_subscripted(tex, old, new):
    """tex の中の「記号 old の直後に _ が続く」箇所を new に付け替える。
    - LaTeX の命令名（\\beta，\\frac など，\\ に続く英字の列）の中の文字は対象にしない。
    - 記号は1文字（英字）を想定。直前が英字でも（d_mb_n の b のように）命令名の一部でなければ対象にする。
    - 戻り値：(新しい文字列, 付け替えた位置のリスト)
    """
    assert len(old) == 1 and len(new) == 1 and old.isalpha() and new.isalpha()
    out, pos, i, n = [], [], 0, len(tex)
    while i < n:
        c = tex[i]
        if c == '\\':
            j = i + 1
            while j < n and tex[j].isalpha():
                j += 1
            if j == i + 1 and j < n:      # \{ \, など英字でない1文字の命令
                j += 1
            out.append(tex[i:j]); i = j; continue
        if c == old and i + 1 < n and tex[i + 1] == '_':
            out.append(new); pos.append(i); i += 1; continue
        out.append(c); i += 1
    return ''.join(out), pos

# 比較用：これまでに使った2つの正規表現
def regex_v1(tex, old, new):   # 1回目（取りこぼしあり）
    return re.sub(r'(?<![A-Za-z\\])' + old + '_', new + '_', tex)
def regex_v2(tex, old, new):   # 2回目
    return re.sub(r'(?<!\\)' + old + '_', new + '_', tex)

# (入力, 期待される出力, 説明)
CASES = [
    (r'$b_n$', r'$d_n$', '単独の b_n'),
    (r'$d_mb_n$', r'$d_md_n$', '積の2つ目の因子（前が英字 m）'),
    (r'$a_nb_n$', r'$a_nd_n$', '別の記号との積'),
    (r'$b_{n+1}$', r'$d_{n+1}$', '波括弧の添字'),
    (r'$\beta_n$', r'$\beta_n$', r'命令 \beta の添字（対象外）'),
    (r'$b_n^2$', r'$d_n^2$', '添字のあとにべき'),
    (r'$\frac{b_n}{a_n}$', r'$\frac{d_n}{a_n}$', '分数の中'),
    (r'$b_{n-1}$', r'$d_{n-1}$', '添字 n-1'),
    ('\\[\nb_mb_n=b_pb_q\\qquad(**)\n\\]', '\\[\nd_md_n=d_pd_q\\qquad(**)\n\\]', r'ディスプレイ数式の中・\qquad の直前'),
    (r'数列 $\{b_n\}$ は，各項 $b_n$ が正である', r'数列 $\{d_n\}$ は，各項 $d_n$ が正である', '日本語の文章の中の数式'),
    (r'$a_2=b$，$b>0$，$ab-1$', r'$a_2=b$，$b>0$，$ab-1$', '添字のない b（問題文の b）は対象外'),
    (r'$\mathbb{R}$，$\boldsymbol{b_n}$', r'$\mathbb{R}$，$\boldsymbol{d_n}$', '命令の引数の中'),
    (r'$\sub_n$，$\textbf b_n$', r'$\sub_n$，$\textbf d_n$', r'英字の命令名 \sub は読み飛ばし，\textbf の後の独立した b_n は対象（v2 は \sub を \sud にしてしまう）'),
    (r'$b_1^{\,2}$，$\beta(b)$，$b_2=\beta(b)$', r'$d_1^{\,2}$，$\beta(b)$，$d_2=\beta(b)$', 'B-SEQ-342 に実際にある形'),
]

def run_tests():
    results = []
    for src, want, why in CASES:
        got, _ = rename_subscripted(src, 'b', 'd')
        r1, r2 = regex_v1(src, 'b', 'd'), regex_v2(src, 'b', 'd')
        results.append({'case': why, 'input': src, 'expected': want, 'tokenizer': got == want,
                        'regex_v1': r1 == want, 'regex_v2': r2 == want, 'v1_output': r1, 'v2_output': r2})
    return results

def changed_only_at(old_text, new_text, old='b', new='d'):
    """old_text→new_text の差が「命令名の外の old_ を new_ にした」位置だけかを確かめる。差の位置のリストと可否を返す。"""
    if len(old_text) != len(new_text):
        return False, 'length differs'
    expected, pos = rename_subscripted(old_text, old, new)
    diffs = [i for i, (a, b) in enumerate(zip(old_text, new_text)) if a != b]
    return (expected == new_text and diffs == pos), diffs

if __name__ == '__main__':
    res = run_tests()
    ok = all(r['tokenizer'] for r in res)
    for r in res:
        print(('✓' if r['tokenizer'] else '✗'), r['case'], '| v1:', '✓' if r['regex_v1'] else '✗', '| v2:', '✓' if r['regex_v2'] else '✗')
    print('字句解析版：', 'すべて合格' if ok else '失敗あり')
    sys.exit(0 if ok else 1)
