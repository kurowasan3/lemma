#!/usr/bin/env python3
"""tools/verify_math.py（自動検証）の単体テスト。架空の問題で、見つけられること・見つけられないことを確かめる"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tools'))
import verify_math as V

passed = failed = 0
def ok(c, m):
    global passed, failed
    if c: passed += 1
    else: failed += 1; print('  FAIL ' + m)

def P(st, ans, sol='解説', pid='T-001'):
    return {'id': pid, 'statement': {'tex': st}, 'answer': {'tex': ans}, 'solutions': [{'tex': sol}], 'idea': {'tex': ''}, 'quality': {'status': 'published', 'checks': {}}}
def res(p): return [x['result'] for x in V.verify(p)['items']]

# ---- 正しい答えは合格、誤った答えは不一致
ok(res(P(r'定積分 $\displaystyle\int_0^1 x(1-x)^5\,dx$ を求めよ．', r'$\frac1{42}$')) == ['pass-symbolic'], '定積分：正しい答えは記号計算で一致')
ok(res(P(r'定積分 $\displaystyle\int_0^1 x(1-x)^5\,dx$ を求めよ．', r'$\frac1{40}$')) == ['fail'], '定積分：誤った答えは不一致（解答の誤りを検出）')
ok(res(P(r'極限 $\displaystyle\lim_{x\to0}\frac{\sin 3x}{x}$ を求めよ．', r'$3$')) == ['pass-symbolic'], '極限：正しい答え')
ok(res(P(r'極限 $\displaystyle\lim_{x\to0}\frac{\sin 3x}{x}$ を求めよ．', r'$\frac13$')) == ['fail'], '極限：誤った答えは不一致')
ok(res(P(r'$a_1=5$，$a_{n+1}=4a_n-3^n$ で定まる数列の一般項を求めよ．', r'$a_n=3^n+2\cdot4^{n-1}$')) == ['pass-symbolic'], '漸化式：初項と漸化式を記号計算で確認')
r = V.verify(P(r'$a_1=5$，$a_{n+1}=4a_n-3^n$ で定まる数列の一般項を求めよ．', r'$a_n=3^n+2\cdot4^{n}$'))
ok(r['items'][0]['result'] == 'fail' and '初項' in r['items'][0]['detail'], '漸化式：初項の合わない答えを不一致に')
ok(res(P(r'方程式 $x^3-6x^2+11x-6=0$ を解け．', r'$x=1,\ 2,\ 3$')) == ['pass-symbolic'], '方程式：解の集合が一致')
ok(res(P(r'方程式 $x^3-6x^2+11x-6=0$ を解け．', r'$x=1,\ 2$')) == ['fail'], '方程式：解の抜けを不一致に')
# 小問ごと（前置きの「次の…を求めよ」を見る）
pp = P('次の定積分を求めよ．\n\\begin{enumerate}\n  \\item $\\displaystyle\\int_0^1x^2\\,dx$\n  \\item $\\displaystyle\\int_0^{\\pi}\\sin x\\,dx$\n\\end{enumerate}', r'(1) $\frac13$　(2) $3$')
ok(res(pp) == ['pass-symbolic', 'fail'], f'小問ごとに照合し、誤った小問だけを不一致に（{res(pp)}）')
ok(V.summary(V.verify(pp)) == 'issue', '不一致の小問があれば問題全体は「不一致あり」')

# ---- 自動検証の対象外は合格にしない
ok(res(P(r'$n$ が自然数のとき，$n^3-n$ は 6 の倍数であることを示せ．', r'証明')) == ['na'], '証明問題は対象外')
ok(V.summary(V.verify(P(r'三角形 ABC の面積を求めよ．', r'$\frac{\sqrt3}{4}$'))) == 'na', '読み取れない図形の問題は対象外（合格にしない）')
ok(res(P(r'$a$ を定数とする．定積分 $\displaystyle\int_0^1 (x-a)^2\,dx$ を求めよ．', r'$a^2-a+\frac13$')) == ['na'], '文字定数を含む積分は対象外（無理に判定しない）')

# ---- 数値・答えの値の照合では、論理の誤りは見つけられない（合格でも人の確認とは別）
wrong_logic = P(r'定積分 $\displaystyle\int_{-1}^{1} x^3\,dx$ を求めよ．', r'$0$', sol='$x^3$ は奇関数だから積分は 0（ここで誤って「偶関数」と書いた解説）')
rw = V.verify(wrong_logic)
ok(rw['items'][0]['result'] == 'pass-symbolic', '答えの値が正しければ合格になる（解説の論理の誤りは見ない）')
ok('解答の論理' in V.__doc__ and '人による数学的確認とは別' in V.__doc__, '自動検証の限界（論理・場合分け・解説は見ない）を明記')

# ---- 構造の検査（条件不足・要求・小問と答えの対応）
l1 = V.lint(P(r'放物線 $y=x^2$ と直線 $y=mx$ で囲まれた部分の面積を求めよ．', r'$\frac{b^3}{6}$', sol='面積は $\frac{m^3}6$'))
ok(any('b' in x and '条件不足' in x for x in l1), f'答えに問題文と解説に無い文字 → 条件不足・記号の未定義の候補（{l1}）')
l2 = V.lint(P('関数 $f(x)=x^2$ について，\n\\begin{enumerate}\n  \\item $f(2)$ を求めよ．\n  \\item $f(3)$ を求めよ．\n  \\item 最小値を求めよ．\n\\end{enumerate}', r'(1) $4$　(2) $9$'))
ok(any('答えの無い小問 (3)' in x for x in l2), f'答えの無い小問を検出（{l2}）')
l3 = V.lint(P('\\begin{enumerate}\n  \\item $\\int_0^1x\\,dx$ と (2) $\\int_0^1x^2\\,dx$ を求めよ．\n\\end{enumerate}', r'(1) $\frac12$　(2) $\frac13$'))
ok(any('小問は 1つなのに' in x for x in l3), f'小問の区切りの誤りを検出（{l3}）')
l4 = V.lint(P(r'$x^2+1$ の値．', r'$2$'))
ok(any('要求' in x for x in l4), f'要求（求めよ・示せ など）が読み取れない問題文を検出（{l4}）')
ok(V.lint(P(r'方程式 $x^2-1=0$ を解け．', r'$x=\pm1$')) == [], '整った問題では構造の候補を出さない')

# ---- v0.27：小問の数え方（入れ子・続きの番号・[I][II] の区切り）と要求の言葉
nest = '前文\n\\begin{enumerate}\n  \\item A を求めよ．\n  \\begin{enumerate}\n    \\item x\n    \\item y\n  \\end{enumerate}\n  \\item B を示せ．\n  \\begin{itemize}\n    \\item 条件\n  \\end{itemize}\n\\end{enumerate}'
ok(len(V.items_of(nest)) == 2, f'入れ子の enumerate・itemize の \\item は小問に数えない（{len(V.items_of(nest))}）')
cont = '\\begin{enumerate}\n  \\item p を示せ．\n\\end{enumerate}\n以下，…とする．\n\\begin{enumerate}[resume]\n  \\item q を求めよ．\n  \\item r を求めよ．\n\\end{enumerate}'
ok(len(V.items_of(cont)) == 3 and V.lint(P(cont, '(1) 証明　(2) $1$　(3) $2$')) == [], '[resume] で続く小問は (2)(3) として数える')
cont2 = cont.replace('[resume]', '').replace('  \\item q', '  \\setcounter{enumi}{1}\n  \\item q')
ok(V.lint(P(cont2, '(1) 証明　(2) $1$　(3) $2$')) == [], '\\setcounter{enumi} で続く小問も同じ')
blocks = '(I) …\n\\begin{enumerate}\n  \\item a を求めよ．\n  \\item b を求めよ．\n\\end{enumerate}\n(II) …\n\\begin{enumerate}\n  \\item c を求めよ．\n  \\item d を求めよ．\n\\end{enumerate}'
ok(V.block_sizes(blocks) == [2, 2] and V.lint(P(blocks, '(I)(1) $1$　(2) $2$　(II)(1) $3$　(2) $4$')) == [], '[I][II] で (1) から数え直す問題は、区切りごとの数で照合する')
for verb in ['確かめよ', 'グラフをかけ．', '概形をえがけ', '導け', '大きい順に並べよ', '表しなさい', '例をあげよ', '言い換えよ', '描いてみよう']:
    ok(V.lint(P(f'$x$ について{verb}', '$1$')) == [], f'要求の言葉「{verb}」を読み取る')
ok(V.lint(P(r'頂点の $y$ 座標が負となる $k$ の範囲は $\fbox{ア}$ である．', '$k>1$')) == [], '空欄補充（数式の中の \\fbox）は要求とみなす')
ok(V.lint(P(r'三角形 ABC で…．形を答えよ．', r'$\angle\mathrm B=90^\circ$ の直角三角形')) == [], '∠B・\\mathrm B は点の名前（答えにだけある文字とみなさない）')

# ---- 照合用の値
a, b = P('問1', '1'), P('問1', '2')
ok(V.content_hash(a) != V.content_hash(b), '内容（答え）が変わると照合用の値が変わる')
print(f'verify_math_test: {passed} 件 OK' + (f'、{failed} 件失敗' if failed else ''))
sys.exit(1 if failed else 0)
