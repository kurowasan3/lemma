#!/usr/bin/env python3
"""人手レビュー13小問の検証補助（機械による検算）。

    python3 docs/audit/2026-11-25/human-review/verify.py   # verify_results.json を書き出す

ここでの計算は「人が判断するための補助」であり，証明ではない。
- 厳密計算（分数・π の有理数倍・SymPy の記号計算）と，数値計算（mpmath 50桁）・有限範囲の総当たりを区別して記録する。
- 有限範囲の確認は，その範囲の外について何も保証しない。
"""
import itertools, json, math, random, sys
from fractions import Fraction as Fr
from pathlib import Path
import mpmath as mp
import sympy as sp

mp.mp.dps = 50
OUT = {}
def rec(key, kind, ok, detail):
    OUT[key] = {'kind': kind, 'ok': bool(ok), 'detail': detail}

# ================================================================ II-TRI-190
# F(x)=sin2x+a(sinx+cosx)=u^2+au-1, u=√2 sin(y), y=x+π/4 ∈ (π/4, nπ+π/4)
def formula_N(a_case, n):
    """登録されている答え (1)(2) の式。a_case: '0','pos_small','pos_eq','pos_big','neg_small','neg_eq','neg_big'"""
    odd = n % 2
    return {'0': 2*n-1, 'pos_small': 2*n-1 if odd else 2*n, 'neg_small': 2*n+1 if odd else 2*n,
            'pos_eq': (3*n-1)//2 if odd else 3*n//2, 'neg_eq': (3*n+1)//2 if odd else 3*n//2,
            'pos_big': n, 'neg_big': n}[a_case]
def count_exact_angles(targets, n):  # targets: y の値（π 単位の分数）の集合（mod 2）
    s = set()
    for t in targets:
        for k in range(-2, n + 3):
            y = t + 2 * k
            if Fr(1, 4) < y < n + Fr(1, 4): s.add(y)
    return len(s)
def count_numeric(a, n):
    a = mp.mpf(a); roots = []
    D = a * a + 4
    for u in [(-a + mp.sqrt(D)) / 2, (-a - mp.sqrt(D)) / 2]:
        v = u / mp.sqrt(2)
        if abs(v) > 1: continue
        assert abs(abs(v) - 1) > mp.mpf('1e-30'), '接する場合は厳密計算で扱う'
        y0 = mp.asin(v)
        for base in (y0, mp.pi - y0):
            for k in range(-2, n + 3):
                y = base + 2 * k * mp.pi
                if mp.pi / 4 < y < n * mp.pi + mp.pi / 4: roots.append(y)
    roots.sort(); uniq = [r for i, r in enumerate(roots) if i == 0 or abs(r - roots[i-1]) > mp.mpf('1e-40')]
    return len(uniq)
bad = []
for n in range(1, 13):
    # a=0：sin2x=0 → x=kπ/2（厳密）
    if sum(1 for k in range(1, 2 * n) if 0 < Fr(k, 2) < n) != formula_N('0', n): bad.append(('0', n))
    # a=±1/√2：u=1/√2,-√2 → sin y=1/2,-1 ／ u=√2,-1/√2 → sin y=1,-1/2（厳密：π の有理数倍）
    if count_exact_angles([Fr(1, 6), Fr(5, 6), Fr(3, 2)], n) != formula_N('pos_eq', n): bad.append(('+1/√2', n))
    if count_exact_angles([Fr(1, 2), Fr(7, 6), Fr(11, 6)], n) != formula_N('neg_eq', n): bad.append(('-1/√2', n))
    for a, c in [('0.3', 'pos_small'), ('0.7', 'pos_small'), ('0.70710', 'pos_small'), ('0.7072', 'pos_big'), ('2', 'pos_big'),
                 ('-0.3', 'neg_small'), ('-0.70710', 'neg_small'), ('-0.7072', 'neg_big'), ('-5', 'neg_big')]:
        if count_numeric(a, n) != formula_N(c, n): bad.append((a, n))
rec('II-TRI-190 (1)(2)', '厳密（a=0, ±1/√2）＋数値50桁（その他の a）・n=1..12', not bad,
    f'登録の式と数え上げが一致しない組：{bad or "なし"}。a=1/√2 では u=-√2（sin y=-1，1周期に1個），a=-1/√2 では u=√2（sin y=1）。')
sol3 = []
for n in range(1, 5001):
    for c, label in [('0', 'a=0'), ('pos_small', '0<a<1/√2'), ('neg_small', '-1/√2<a<0'), ('pos_eq', 'a=1/√2'), ('neg_eq', 'a=-1/√2'), ('pos_big', 'a>1/√2'), ('neg_big', 'a<-1/√2')]:
        if formula_N(c, n) == 2025: sol3.append((label, n))
rec('II-TRI-190 (3)', '(2) の式に対する総当たり（n≦5000。式から n>2025 では N≧n>2025 で解がないことは明らか）',
    sorted(sol3) == sorted([('a=0', 1013), ('0<a<1/√2', 1013), ('a=1/√2', 1350), ('a=-1/√2', 1350), ('a>1/√2', 2025), ('a<-1/√2', 2025)]),
    f'N(a,n)=2025 となる組：{sol3}')

# ================================================================ III-DIF-356 (2)
x, t = sp.symbols('x t', real=True)
def nondiff_count(H, tv):
    # H(x,t)：|f(x)-tx| の定数倍（有理係数）。|H| が微分不可能な点＝H(x,tv) の実数の単根
    h = sp.Poly(sp.expand(H.subs(t, tv)), x)
    sq = sp.sqf_list(h.as_expr())[1]
    return sum(len(sp.real_roots(sp.Poly(fac, x))) for fac, m in sq if m == 1 and sp.Poly(fac, x).degree() > 0)
def discontinuities(H):
    Hp = sp.Poly(sp.expand(H), x)
    disc = sp.discriminant(Hp.as_expr(), x)   # x=0 が重根になる t（t=p(0)）も判別式の零点に含まれる
    crit = [r for r in sp.Poly(disc, t).real_roots()]
    res = []
    for c in sorted(set(crit), key=lambda z: float(z)):
        g0 = nondiff_count(H, c)
        eps = sp.Rational(1, 10**6)
        gl, gr = nondiff_count(H, c - eps), nondiff_count(H, c + eps)
        if not (gl == g0 == gr): res.append((c, gl, g0, gr))
    return res
c4 = sp.root(4, 3)
# ∛4 を含む2つは x=∛4·y と置くと |f-tx| = ∛4·|y(4(y±1)^3+(1 or 5)-t)| となり有理係数になる（点の個数は変わらない）
F356 = {'x^4+3x^3+x': x**4 + 3*x**3 + x - t*x, 'x^4-3x^3+5x': x**4 - 3*x**3 + 5*x - t*x,
        'x^4+6x^3+9x^2+5x': x**4 + 6*x**3 + 9*x**2 + 5*x - t*x, 'x^4-6x^3+9x^2+x': x**4 - 6*x**3 + 9*x**2 + x - t*x,
        'x(x+∛4)^3+x': x*(4*(x + 1)**3 + 1 - t), 'x(x-∛4)^3+5x': x*(4*(x - 1)**3 + 5 - t)}
yy = sp.symbols('yy')
assert sp.expand(((x*(x + c4)**3 + x - t*x)).subs(x, c4*yy) - c4*(yy*(4*(yy + 1)**3 + 1 - t))) == 0
assert sp.expand(((x*(x - c4)**3 + 5*x - t*x)).subs(x, c4*yy) - c4*(yy*(4*(yy - 1)**3 + 5 - t))) == 0
d356 = {k: [str(z[0]) for z in discontinuities(v)] for k, v in F356.items()}
rec('III-DIF-356 (2)', 'SymPy（判別式で臨界の t を求め，各 t と ±10^-6 で単解の個数を厳密に数える）',
    all(set(v) == {'1', '5'} for v in d356.values()), f'各 f の不連続点：{d356}。6つの f が条件をみたすことの確認であり，「これ以外にない」ことは解説の論証による')
# (1) の検算も
d1 = [str(z[0]) for z in discontinuities(x**4 - 3*x**2 + x - t*x)]
rec('III-DIF-356 (1) 参考', 'SymPy', set(d1) == {'-1', '1', '3'}, f'f=x^4-3x^2+x の不連続点：{d1}')

# ================================================================ III-DIF-374 (2)
def _bisect(f, lo, hi, it=400):
    flo = f(lo)
    for _ in range(it):
        mid = (lo + hi) / 2; fm = f(mid)
        if (fm > 0) == (flo > 0): lo, flo = mid, fm
        else: hi = mid
    return (lo + hi) / 2
def roots374(b):
    # f(x)=e^x-bx+e^2 は x<L で減少，x>L で増加（L=log b），f(0)>0，f(L)<0
    L = mp.log(b); f = lambda z: mp.e**z - b * z + mp.e**2
    hi = L + 1
    while f(hi) < 0: hi *= 2
    return L, _bisect(f, mp.mpf(0), L), _bisect(f, L, hi)
mp.mp.dps = 200   # L=200 では e^2/(b·x2)≈e^{-200} なので桁数を上げる
viol = []; old_false = 0; samples = 0
for Lv in [mp.mpf(4) + mp.mpf(10)**-k for k in (12, 6, 3)] + [mp.mpf(v) for v in ('4.01', '4.5', '5', '6', '8', '10', '15', '20', '40', '80', '200')]:
    b = mp.e**Lv; L, x1, x2 = roots374(b); samples += 1
    f = lambda z: mp.e**z - b * z + mp.e**2
    if not f(L + mp.log(L)) < 0: viol.append(('f(L+logL)<0', Lv))
    if not x2 > L + mp.log(L): viol.append(('x2>L+logL', Lv))
    if not x2 > b * L * x1 / (mp.e**2 + 1): viol.append(('結論', Lv))
    if x2 < L + mp.log(x2): old_false += 1
mp.mp.dps = 50
rec('III-DIF-374 (2)', '数値50桁（L=4+10^-12 から 200 まで14点）', not viol and old_false == samples,
    f'修正後の各不等式の反例：{viol or "なし"}。修正前の主張「x2>L+log x2」は {old_false}/{samples} 点で偽（正しくは x2<L+log x2）。')

# ================================================================ A-COM-510 (2)
def has_Q(T, m, n):
    for k in range(m):
        for l in range(k + 1, m):
            s = l - k
            for p in range(n - s):
                if T[k][p] + T[k][p + s] + T[l][p] + T[l][p + s] != 0: return False
    return True
res510 = {}
for n in range(2, 7):
    cnt = 0; ones = set(); typeII = 0
    for bits in itertools.product((1, -1), repeat=4 * n):
        T = [bits[i * n:(i + 1) * n] for i in range(4)]
        if has_Q(T, 4, n):
            cnt += 1; ones.add(sum(1 for v in bits if v == 1))
            if all(T[i][j] * T[i][j + 1] == -1 for i in range(4) for j in range(n - 1)): typeII += 1
    res510[n] = (cnt, sorted(ones), typeII)
rec('A-COM-510 (2)', '総当たり（m=4，n=2..6 のすべての表）',
    all(v[1] == [2 * n] for n, v in res510.items() if n >= 3) and res510[4][0] == 8,
    f'n: (性質Qをもつ表の数, 1の個数の集合, (II)型の数) = {res510}。n≧3 で 1 の個数は常に 2n。'
    '1辺2の正方形が表に収まる⇔ 3行以上かつ3列以上（m-1≧2 かつ n-1≧2），m=4 では n≧3 と同値。')

# ================================================================ B-SEQ-342
def ok_star(seq, N):
    vals = {}
    for m in range(1, N + 1):
        for n in range(m, N + 1):
            v = (1 + seq[m] * seq[n]) / (seq[m] + seq[n])
            if vals.setdefault(m + n, v) != v: return False
    return True
a1 = {n: Fr(2 * 3**(n - 1) + 2**(n - 1), 2 * 3**(n - 1) - 2**(n - 1)) for n in range(1, 31)}
ok1 = a1[1] == 3 and a1[2] == 2 and ok_star(a1, 30) and all(v > 0 for v in a1.values())
def seq_from(a, b, N):
    """b_n=(a_n-1)/(a_n+1) が等比数列になる（(1) の解き方とは独立に (*) を直接検査する）ので，
    a_1=a, a_2=b から決まる数列を N 項まで作り，途中で正でなくなれば None。"""
    ba, bb = (a - 1) / (a + 1), (b - 1) / (b + 1)
    if ba == 0: return None if bb != 0 else {n: Fr(1) for n in range(1, N + 1)}
    r = bb / ba; s = {}; keep = N
    if abs(r) > 1:   # |d_n| が 1 を超える最初の n まで必ず調べる（比が 1 に近いと 60 項では足りない）
        N = max(N, int(math.log(1 / abs(float(ba))) / math.log(abs(float(r)))) + 3)
    for n in range(1, N + 1):
        d = ba * r**(n - 1)
        if not (-1 < d < 1): return None
        if n <= keep: s[n] = (1 + d) / (1 - d)
    return s
random.seed(1); mism = []
for _ in range(400):
    a = Fr(random.randint(1, 60), random.randint(1, 20)); b = Fr(random.randint(1, 60), random.randint(1, 20))
    s = seq_from(a, b, 60); cond = (a - b) * (a * b - 1) >= 0
    if (s is not None and ok_star(s, 12)) != cond: mism.append((a, b))
for a in [Fr(1), Fr(2), Fr(1, 3)]:
    for b in [a, 1 / a]:
        s = seq_from(a, b, 60)
        if s is None or not ok_star(s, 12): mism.append(('境界', a, b))
rec('B-SEQ-342 (1)', '厳密（分数）：n≦30 で (*) をみたし a1=3,a2=2', ok1, '一般項 (2·3^{n-1}+2^{n-1})/(2·3^{n-1}-2^{n-1}) は (*) を m+n≦60 の範囲でみたす')
rec('B-SEQ-342 (2)', '厳密（分数）：ランダムな正の有理数 400 組＋境界（b=a，b=1/a）。存在の判定は |d_n|<1 が破れる最初の項まで調べる（比が1に近い組も含む）',
    not mism, f'条件 (a-b)(ab-1)≧0 と存在の判定が食い違った組：{mism or "なし"}')
lim = []
for a, b in [(Fr(3), Fr(2)), (Fr(2), Fr(3, 2)), (Fr(1), Fr(1))]:
    s = seq_from(a, b, 200); lim.append(float(s[200]))
s_osc = seq_from(Fr(3), Fr(1, 3), 10)
rec('B-SEQ-342 (3)', '厳密（分数）：第200項の値と振動の確認', all(abs(v - 1) < 1e-9 for v in lim) and s_osc[1] == 3 and s_osc[2] == Fr(1, 3) and s_osc[3] == 3,
    f'(a-b)(ab-1)>0 または a=b=1 の例で第200項 ≈ {lim}（極限1と整合）。b=1/a（a=3）では 3,1/3,3,… と振動。b=a は定数列')

# ================================================================ C-CUR-459 (1)
s_ = sp.symbols('s', positive=True)
m_ = (s_ - 1) / 2; al2 = ((3 - s_) / 2)**2; be2 = s_ * (3 - s_)**2 / (2 * (1 - s_))
on = lambda X, Y: sp.simplify((X - m_)**2 / al2 + Y**2 / be2 - 1)
ok_pts = all(on(X, Y) == 0 for X, Y in [(1, 0), (s_, 2 * sp.sqrt(s_)), (-1, 2 * sp.sqrt(s_))])
cmp_ = sp.factor(sp.simplify(al2 - be2))
at13 = (al2 - be2).subs(s_, sp.Rational(1, 3))
gamma2 = sp.factor(sp.simplify(al2 - be2))
rec('C-CUR-459 (1)', 'SymPy', ok_pts and at13 == 0,
    f'中心 ((s-1)/2,0)，α^2=((3-s)/2)^2，β^2=s(3-s)^2/(2(1-s)) の曲線は F,A,H を通る：{ok_pts}。α^2-β^2 = {cmp_}。'
    's=1/3 で α=β（円：中心 (-1/3,0)，半径 4/3）。1/3<s<1 では α<β で焦点は y 軸に平行な直線上（x 軸上にない）。'
    '円を含める読み方では (1) は 0<s≦1/3，(3) の B の x 座標は円の中心 -1/3 も含めて -1/3≦x<1（ただし円では「x 座標が大きい方の焦点」が定まらない）')

# ================================================================ II-GEO-300 (2)
q_, r_, y1, y2 = sp.symbols('q r y1 y2', real=True)
m0 = -r_ / q_
eta = sp.expand((q_ * y1 + r_) * (q_ * y2 + r_) - q_**2 * (y1 - m0) * (y2 - m0))
cc = sp.symbols('c', positive=True)
def Yset_gap(cv):
    # E の y 座標の集合（y≠0, |y(y-2)|≦c）のすき間 (γ1,γ2) を数値で
    ys = [i / 2000 for i in range(-4000, 8001) if i != 0]
    inE = [y for y in ys if abs(y * (y - 2)) <= cv]
    return min(inE), max(inE), [ (a, b) for a, b in zip(inE, inE[1:]) if b - a > 0.0011 ]
gaps = {cv: Yset_gap(cv) for cv in (0.3, 0.75, 1.0, 2.0)}
rec('II-GEO-300 (2)', 'SymPy（恒等式）＋数値（y を 1/2000 刻み）', eta == 0,
    f'(qy1+r)(qy2+r)-q^2(y1-m)(y2-m)={eta}（m=-r/q）。E の y 座標の集合のすき間（数値）：'
    + '; '.join(f'c={k}: {v[2]}' for k, v in gaps.items())
    + '。0<c<1 では (1-√(1-c), 1+√(1-c)) のすき間と y=0 の周り，c≧1 では y=0 の周りだけ')

# ================================================================ III-DIF-359 (1)
X = sp.symbols('X', real=True)
okD = True; detail = []
for n in range(1, 7):
    for cs in itertools.product((1, -1), repeat=n):
        g = sum(c * sp.Abs(sp.exp(X**k) - sp.E) for k, c in enumerate(cs, 1))
        h = sp.Rational(1, 10**8)
        # x=-1 での片側微分係数（記号的に：|φ| を近くの符号で外して微分）
        right = sum(c * (sp.sign(sp.N((sp.exp(X**k) - sp.E).subs(X, -1 + h))) * sp.diff(sp.exp(X**k) - sp.E, X)).subs(X, -1) for k, c in enumerate(cs, 1))
        left = sum(c * (sp.sign(sp.N((sp.exp(X**k) - sp.E).subs(X, -1 - h))) * sp.diff(sp.exp(X**k) - sp.E, X)).subs(X, -1) for k, c in enumerate(cs, 1))
        Dv = -sp.exp(-1) * sum(c * k for k, c in enumerate(cs, 1) if k % 2)
        Ev = sum(c * k for k, c in enumerate(cs, 1) if k % 2 == 0)
        if sp.simplify(right - (Dv + sp.E * Ev)) != 0 or sp.simplify(left - (Dv - sp.E * Ev)) != 0: okD = False; detail.append(cs)
rec('III-DIF-359 (1)', 'SymPy（n≦6 のすべての符号の組で x=-1 の片側微分係数を厳密に計算）', okD,
    f'右側＝D+eE，左側＝D-eE（D=-e^{{-1}}Σ_奇 c_k k，E=Σ_偶 c_k k）が成り立たない組：{detail or "なし"}。修正前の「±eE」は D≠0 のとき誤り（例：n=1，c=(1) で D=-e^{{-1}}≠0）')

# ================================================================ III-DIF-380 (2)
def nroots(a, b):
    """f(x)=a^x+b^x-x-2 の実数解（倍精度）。x=0 は常に解。粗い格子（|x|≦150，刻み 0.05）と
    0 の近く（|x|≦1，刻み 1e-4）で符号変化を探し，x=0 を含む区間は除いて 0 を別に数える。"""
    f = lambda z: a**z + b**z - z - 2
    grid = sorted(set([i / 20 for i in range(-3000, 3001)] + [i / 10000 for i in range(-10000, 10001)]))
    out = [0.0]
    for z0, z1 in zip(grid, grid[1:]):
        if z0 == 0 or z1 == 0: continue
        if f(z0) * f(z1) < 0:
            lo, hi = z0, z1
            for _ in range(80):
                mid = (lo + hi) / 2
                if f(lo) * f(mid) <= 0: hi = mid
                else: lo = mid
            out.append((lo + hi) / 2)
    return out
random.seed(2); bad380 = []; checked = 0; one = 0
for _ in range(300):
    # 1 にごく近い底では2つめの解が |x|≦150 の外に出るので，底は [0.05,0.9]∪[1.2,6] から選ぶ
    a, b = random.choice([random.uniform(0.05, 0.9), random.uniform(1.2, 6)]), random.choice([random.uniform(0.05, 0.9), random.uniform(1.2, 6)])
    if abs(a * b - math.e) < 0.05: continue
    rs = nroots(a, b)
    two = len(rs) == 2
    expect_two = (a > 1 or b > 1)
    if two != expect_two: bad380.append(('個数', a, b, len(rs))); continue
    if not two: one += 1
    if two:
        checked += 1
        gam = max(rs, key=abs)
        if (gam > 0) != (a * b < math.e): bad380.append(('符号', a, b, gam))
rec('III-DIF-380 (2)', '数値（倍精度，ランダムな (a,b) 約300組，格子で符号変化を探す。底は 1 に近すぎないもの）', not bad380,
    f'解が2個の {checked} 組（1個は {one} 組で，すべて a≦1 かつ b≦1）で「γ>0 ⇔ ab<e」と食い違う組：{bad380 or "なし"}。a≦1 かつ b≦1 では ab<e でも解は1個（例 a=b=1/2）')

Path(__file__).with_name('verify_results.json').write_text(json.dumps(OUT, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
for k, v in OUT.items(): print(('✓' if v['ok'] else '✗'), k)
sys.exit(0 if all(v['ok'] for v in OUT.values()) else 1)
