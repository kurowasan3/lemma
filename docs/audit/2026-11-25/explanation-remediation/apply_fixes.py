#!/usr/bin/env python3
"""解説監査（2026-11-25）で見つかった問題の修正を content/problems/*.json に適用する。

リポジトリのルートで `python3 docs/audit/2026-11-25/explanation-remediation/apply_fixes.py` と実行する。
  --check   書き換えずに、各修正が「未適用」「適用済み」のどちらかを表示する（どちらでもなければ失敗）

- 各修正は (問題ID, 欄, 修正前の文, 修正後の文)。欄は answer / solution:<id> / idea。
- 修正前の文が欄の中にちょうど1回あるときだけ置き換える（0回・2回以上なら何もせず失敗）。
- B-SEQ-342 は記号の付け替え（添字つきの b_ → d_）で，正規表現で行い，件数を記録する。
- 問題文・ID・タグ・難易度・品質データには触れない。
- 書式は元のファイルと同じ（indent=1，ensure_ascii=False，末尾改行）。

注意：content/ は管理表（Lemma問題管理表.xlsx）から tools/import_xlsx.py で作り直される。
この修正は管理表の I 列（答え）・J 列（解答・解説）・K 列（着想）にも同じ内容を入れないと，次の取り込みで消える。
"""
import json, re, sys
from pathlib import Path

ROOT = Path.cwd()
FILES = {
    'III-DIF-374': 'content/problems/III-16.json', 'III-DIF-380': 'content/problems/III-16.json',
    'III-DIF-359': 'content/problems/III-16.json', 'A-GEO-115': 'content/problems/A-06.json',
    'C-CUR-459': 'content/problems/C-19.json', 'C-CUR-484': 'content/problems/C-19.json',
    'II-GEO-300': 'content/problems/II-09.json', 'B-SEQ-342': 'content/problems/B-13.json',
    'II-CAL-312': 'content/problems/II-12.json',
}

FIXES = [
    # ---- D：III-DIF-374 (2) 不等号の向きの誤り
    ('III-DIF-374', '(2)', 'solution:main',
     r'$f(x_2)=0$ より $e^{x_2}=bx_2-e^2<bx_2$，両辺の対数をとって $x_2>L+\log x_2>L+\log L$（$x_2>L>1$）．',
     r'次に $x_2$ を下から評価する．$x_4=L+\log L$ とおくと，$L>4$ より $\log L>\log4>1$ なので $x_4>L$ であり，$e^{x_4}=e^L\cdot L=bL$ より' '\n'
     r'\[' '\n'
     r'f(x_4)=bL-b(L+\log L)+e^2=e^2-b\log L.' '\n'
     r'\]' '\n'
     r'$\log L>1$ と $b>e^4$ より $b\log L>b>e^4>e^2$ なので $f(x_4)<0$．$f$ は $x\geqq L$ で増加し，その範囲の零点は $x_2$ だけだから，$f(x_4)<0=f(x_2)$ より $x_2>x_4=L+\log L$．'),
    ('III-DIF-374', '(2)', 'idea',
     r'大きい方の零点は $e^{x_2}<bx_2$ から $x_2>\log b+\log x_2$ で，$\log b$ より $\log(\log b)$ 程度大きい．',
     r'大きい方の零点は $f(\log b+\log(\log b))=e^2-b\log(\log b)<0$ から $x_2>\log b+\log(\log b)$ で，$\log b$ より $\log(\log b)$ 程度大きい．'),
    # ---- B：A-GEO-115 (1) K≠P，K≠L の根拠
    ('A-GEO-115', '(1)', 'solution:main',
     r'K は三角形 PAD の内部または周上の，直線 PL 上の点なので線分 PL 上にあり，B，C と異なるから P，L とも異なる．よって K は線分 BC の内部にあり，P，K，L はこの順に並ぶ．',
     r'K は三角形 PAD の内部または周上の，直線 PL 上の点なので線分 PL 上にある．直線 PL は直線 PA，PD と P だけで交わり，B，C は P と異なるので，B，C は直線 PL 上になく K$\neq$B，C．また P は直線 AB 上の B と異なる点で，直線 AB と直線 BC は B だけで交わるので，P は直線 BC 上になく K$\neq$P．さらに直線 BC と直線 AD はただ1点 Q で交わり，Q は線分 BC の外（C の先）にあるので，線分 BC は直線 AD と共有点をもたず K$\neq$L．よって K は線分 BC の内部にあり，P，K，L はこの順に並ぶ．'),
    # ---- B：C-CUR-459 (1) 円を除く理由
    ('C-CUR-459', '(1)', 'solution:main',
     '\\]\nと表せる．\n\n\\textbf{必要条件．}',
     '\\]\nと表せる．ここで $\\alpha=\\beta$（円）は含めない．楕円の2つの焦点は相異なる2点であり，円はそのような2つの焦点をもたないからである．焦点が $x$ 軸上にあるので長軸は $x$ 軸方向で，$\\alpha>\\beta$ である．\n\n\\textbf{必要条件．}'),
    # ---- B：C-CUR-484 (2) E，F の実在と，EF と直線の一致の排除
    ('C-CUR-484', '(2)', 'solution:main',
     r'\text{ を除いた部分}}.' '\n' r'\]',
     r'\text{ を除いた部分}}.' '\n' r'\]' '\n'
     r'（各 $\lambda\neq0$ について条件をみたす E，F は実際に存在するので，$\mathrm P_\lambda$ は確かに定まる．A における $C$ の接線の傾きは $-\dfrac12$ なので，$k_1\neq k_2$，$k_1+k_2=\lambda$，$k_1\neq-\dfrac12$，$k_2\neq-\dfrac12$ をみたす $k_1,k_2$ をとると，A を通り傾き $k_1,k_2$ の直線は $C$ と A 以外の点 E，F でそれぞれ交わり，傾きが異なるので E$\neq$F である．）'),
    ('C-CUR-484', '(2)', 'solution:main',
     r'これは直線 $y=\dfrac12x-2$ と平行である．',
     r'これは直線 $y=\dfrac12x-2$ と平行である．なお，直線 EF が直線 $y=\dfrac12x-2$ と一致することはない．一致するのは $Y=\dfrac12X-3$，すなわち $u=\dfrac16$ のときで，この直線 $x-2y=4$ を $C$ の式に代入すると $(2y+3)^2=0$ となり，$C$ と点 $\left(1,-\dfrac32\right)$ で接するだけなので，異なる2点 E，F を通らないからである．'),
    # ---- B：II-GEO-300 (2) 直線の表し方によらないこと
    ('II-GEO-300', '(2)', 'solution:main',
     r'直線 $y=m$（方程式 $y-m=0$）について，2点の $\eta$ は $(y_1-m)(y_2-m)$ である．',
     r'直線 $y=m$ について，2点の $\eta$ の符号は $(y_1-m)(y_2-m)$ の符号と同じである．実際，この直線の方程式を $qy+r=0$（$q\neq0$，$m=-\dfrac rq$）と書くと $\eta=(qy_1+r)(qy_2+r)=q^2(y_1-m)(y_2-m)$ で，$q^2>0$ だから，符号は方程式の書き方によらない．'),
    # ---- B：III-DIF-380 (2) 前提条件の明示（答えにも）
    ('III-DIF-380', '(2)', 'answer',
     r'(2) 証明；$\gamma>0\iff ab<e$',
     r'(2) 証明；解がちょうど2個のとき $\gamma>0\iff ab<e$（$a,b$ だけの条件で書くと「$a>1$ または $b>1$」かつ $ab<e$）'),
    ('III-DIF-380', '(2)', 'solution:main',
     r'したがって $\boldsymbol{\gamma>0\iff ab<e}$．',
     r'したがって，解がちょうど2個のとき $\boldsymbol{\gamma>0\iff ab<e}$．' '\n\n'
     r'ここで「解がちょうど2個」は「$a>1$ または $b>1$」かつ「$ab\neq e$」と同値なので，$a,b$ だけの条件として書くと，$\gamma>0$ となるのは「$a>1$ または $b>1$」かつ「$ab<e$」のときである（$a\leqq1$ かつ $b\leqq1$ のときも $ab<e$ だが，そのときは解が $x=0$ の1個だけで $\gamma$ は存在しない）．'),
    # ---- C：II-CAL-312 (3) 3で割る一段
    ('II-CAL-312', '(3)', 'solution:main',
     r'条件は $3c(3-\beta)=3$，$c(\beta-1)=3$．辺々加えて $2c=4$，',
     r'条件は $3c(3-\beta)=3$，$c(\beta-1)=3$．前者を3で割ると $c(3-\beta)=1$ で，これと後者を辺々加えて $2c=4$，'),
    # ---- C：III-DIF-359 (1) x=-1 での片側微分係数
    ('III-DIF-359', '(1)', 'solution:main',
     r'よって $g$ の右側・左側の微分係数は $\pm e\,E$（$E$ は偶数 $k$ についての $c_kk$ の和）で，$g$ が $x=-1$ で微分可能 $\iff E=0$．',
     r"奇数 $k$ の項は $x=-1$ の近くで $\varphi_k<0$ なので $|\varphi_k|=-\varphi_k$ で，その微分係数は $-\varphi_k'(-1)=-ke^{-1}$ である（$k$ が奇数なので $\varphi_k'(-1)=ke^{-1}$）．$D=-e^{-1}\sum_{k\text{ が奇数}}c_kk$，$E=\sum_{k\text{ が偶数}}c_kk$ とおくと，$g$ の $x=-1$ での右側・左側の微分係数はそれぞれ $D+eE$，$D-eE$ である．よって $g$ が $x=-1$ で微分可能 $\iff D+eE=D-eE\iff E=0$．"),
]
# ---- C：B-SEQ-342 記号の衝突（問題文の b=a_2 と補助数列 b_n）→ 補助数列を d_n に
#      （c は解説の「準備」で定数として使われているので c_n にすると新たに衝突する。d は未使用）
#      添字つきの b_ はすべて補助数列（問題文の b は添字をもたない）。\beta_ などの命令は b の前が \\ なので除く。
#      （当初は「前が英字の b_」も除いていたため，d_mb_n の b_n などの積の2つ目の因子が付け替わらなかった。再検証で指摘され修正）
RENAME = ('B-SEQ-342', ['solution:main', 'idea'], re.compile(r'(?<!\\)b_'), 'd_')

def field_get(p, fld):
    if fld == 'answer': return p['answer']['tex']
    if fld == 'idea': return p['idea']['tex']
    sid = fld.split(':', 1)[1]
    return next(s for s in p['solutions'] if s['id'] == sid)['tex']

def field_set(p, fld, val):
    if fld == 'answer': p['answer']['tex'] = val; return
    if fld == 'idea': p['idea']['tex'] = val; return
    sid = fld.split(':', 1)[1]
    next(s for s in p['solutions'] if s['id'] == sid)['tex'] = val

def load(path):
    d = json.loads((ROOT / path).read_text(encoding='utf-8'))
    return d, (d if isinstance(d, list) else d.get('problems', [d]))

def main(check_only=False):
    docs, status, fail = {}, [], False
    for path in sorted(set(FILES.values())): docs[path] = load(path)
    def prob(pid): return next(x for x in docs[FILES[pid]][1] if x.get('id') == pid)
    for pid, sp, fld, old, new in FIXES:
        p = prob(pid); text = field_get(p, fld)
        n_old, n_new = text.count(old), text.count(new)
        # 修正後の文が修正前の文を含む（追記型の）修正があるので，先に「修正後があるか」を見る
        if n_new == 1:
            status.append((pid, sp, fld, '適用済み'))
        elif n_old == 1 and n_new == 0:
            if not check_only: field_set(p, fld, text.replace(old, new))
            status.append((pid, sp, fld, '適用' if not check_only else '未適用'))
        else:
            status.append((pid, sp, fld, f'失敗（修正前 {n_old} 回・修正後 {n_new} 回）')); fail = True
    pid, flds, rx, rep = RENAME
    p = prob(pid)
    for fld in flds:
        text = field_get(p, fld); n = len(rx.findall(text))
        if n:
            if not check_only: field_set(p, fld, rx.sub(rep, text))
            status.append((pid, '(1)〜(3)', fld, f'{"適用" if not check_only else "未適用"}（b_→d_ {n} 箇所）'))
        else:
            status.append((pid, '(1)〜(3)', fld, '適用済み（b_ なし）'))
    if not check_only and not fail:
        for path, (d, _) in docs.items():
            (ROOT / path).write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for s in status: print(' | '.join(s))
    return 1 if fail else 0

if __name__ == '__main__':
    sys.exit(main('--check' in sys.argv))
