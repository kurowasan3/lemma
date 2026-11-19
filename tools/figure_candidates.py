#!/usr/bin/env python3
"""問題文（LaTeX）から、グラフに描けそうな式の候補を取り出す（「問題の図」の自動作成）。

    python3 tools/figure_candidates.py [content フォルダ]   → 標準出力に JSON
        { 問題ID: { "after": 図示する問題か, "h": 問題文のハッシュ, "cands": [ { "mode": 2d|complex|vector|3d, "src": 式 } ] } }

ここでは「それらしい式」を広めに拾うだけ。本当に描けるかは tools/make_figures.mjs がアプリと同じ解析器で確かめて選ぶ。
取り出すもの：
  2d     … y=…、f(x)=…（y=… に直す）、x と y の両方を含む等式・不等式（円・領域など）、点 A(1, 2)
  complex… z を含む式（|z-1|=2、\\arg z、\\overline{z}）、α=1+2i のような複素数の定義
  vector … \\vec{a}=(1,2)、\\overrightarrow{OA}=(1,2)、点 A(1,2) とベクトルの式
  3d     … x, y, z を含む等式（平面・球）、3成分の点 A(1,2,3)・ベクトル
答えが図そのものになる問題（「図示せよ」「概形をかけ」など）は after=true（答え合わせのあとで見せる）。
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import make_input_answers as MI   # noqa: E402  tex2expr（LaTeX → アプリの入力書式）を使う

AFTER = re.compile(r'図示|概形|グラフを(?:かけ|描け|書け|かき|描き)|図に(?:示|かけ)|領域を(?:求め|図)|軌跡|どのような(?:図形|曲線|直線|円|線|領域)|どんな(?:図形|曲線|直線)|表す図形|描く図形|えがく図形')
MATH = re.compile(r'\$\$(.+?)\$\$|\$(.+?)\$|\\\[(.+?)\\\]|\\\((.+?)\\\)', re.S)
CAP = r'(?:\\mathrm\{([A-Z])\}|(?<![A-Za-z\\])([A-Z]))'
NUM = r'-?\s*(?:\\frac\{[^{}]+\}\{[^{}]+\}|\\sqrt\{[^{}]+\}|\d+(?:\.\d+)?)'


def clean(t):
    """tex2expr が読めるように、表示用の命令を外したり置き換えたりする"""
    t = re.sub(r'\\(?:displaystyle|textstyle|left|right|bigl|bigr|Bigl|Bigr|big|Big|,|;|!|quad|qquad)\b', ' ', t)
    t = t.replace('\\ ', ' ').replace('~', ' ')
    t = re.sub(r'\\mathrm\{(Re|Im)\}', r'\1', t)
    t = re.sub(r'\\operatorname\{(Re|Im|arg)\}', r'\1', t)
    t = re.sub(r'\\mathrm\{([A-Za-z])\}', r'\1', t)
    t = re.sub(r'\\(?:overline|bar)\{\s*([a-zα-ω]|\\[a-z]+)\s*\}', r'conj(\1)', t)
    t = re.sub(r'\\(?:overline|bar)\s+([a-z])', r'conj(\1)', t)
    t = re.sub(r'\\arg\b', 'arg', t)
    # ベクトル：\vec{a} → a、\overrightarrow{OA} → A（原点からの位置ベクトル）、\overrightarrow{AB} → (B-A)
    t = re.sub(r'\\(?:vec|overrightarrow|boldsymbol|mathbf|bm)\{\s*\\mathrm\{([A-Z])([A-Z])\}\s*\}', r'\\overrightarrow{\1\2}', t)
    t = re.sub(r'\\overrightarrow\{\s*O\s*([A-Z])\s*\}', r'\1', t)
    t = re.sub(r'\\overrightarrow\{\s*([A-Z])\s*([A-Z])\s*\}', r'(\2-\1)', t)
    t = re.sub(r'\\(?:vec|overrightarrow|boldsymbol|mathbf|bm)\{\s*([a-zA-Z])\s*\}', r'\1', t)
    t = re.sub(r'\\vec\s+([a-zA-Z])', r'\1', t)
    return t


def to_expr(t):
    """LaTeX の1つの式 → アプリの書式（だめなら None）"""
    t = clean(t).strip().rstrip('．。.,，')
    if not t or re.search(r'\\(?:int|sum|lim|prod|log_|binom|cdots|ldots|dots|cases|begin|text|mbox|in\b|subset|cap|cup|to\b|infty)', t):
        return None
    t = t.replace('\\cdot', '·') if re.search(r'[a-zA-Z]\s*\\cdot\s*[a-zA-Z(]', t) else t
    keep_dot = '·' in t
    t = t.replace('·', '\\cdot')
    t = re.sub(r'\\neq\b|\\ne\b', '≠', t)
    try:
        e = MI.simplify_parens(MI.tex2expr(t.replace('≠', '=')))
    except Exception:
        return None
    if '≠' in t:
        return None
    if keep_dot:
        e = e.replace('*', '·')
    e = re.sub(r'\s+', ' ', e).strip()
    return e or None


def split_math(m):
    """1つの数式の中の、カンマ・「かつ」で並んだ複数の式を分ける（括弧の中のカンマは成分の区切りなので分けない）"""
    out, depth, last = [], 0, 0
    s = m
    k = 0
    while k < len(s):
        c = s[k]
        if c in '({[':
            depth += 1
        elif c in ')}]':
            depth -= 1
        elif depth == 0 and (c == ',' or s.startswith('\\quad', k) or s.startswith('\\text{かつ}', k)):
            out.append(s[last:k])
            last = k + 1
        k += 1
    out.append(s[last:])
    return [x.strip() for x in out if x.strip()]


def letters(e):
    return set(re.findall(r'[A-Za-zα-ω]', re.sub(r'\b(sin|cos|tan|log|exp|sqrt|abs|conj|arg|Re|Im)\b', ' ', e)))


def xvar_to_t(f):
    """式の中の x を t に（2ax のような暗黙の積の x も。関数名 exp の x は残す）"""
    return f.replace('exp', '\0').replace('x', 't').replace('\0', 'exp')
INTERVAL = re.compile(r'^\s*([^<>=]+?)\s*<=?\s*x\s*<=?\s*([^<>=]+?)\s*$')


def with_domain(src, lo, hi):
    """y=f(x) と a<=x<=b → 媒介変数 (t, f(t)) t:a..b（2D のグラフは y=f(x) に範囲を付けられないため）"""
    f = src.split('=', 1)[1]
    return f'(t, {xvar_to_t(f)}) t:{lo}..{hi}'


CPX = re.compile(r'複素|\\overline\{\s*z|\\bar\{?\s*z|\\arg|\|\s*z|z\s*=\s*[^$]*\bi\b|虚数|実部|虚部')
SPACE = re.compile(r'空間|球|四面体|立方体|直方体|平面\s*\$|平面[^上]|xyz|z\s*軸|正四面体|角錐|角柱')


def classify(e, vecctx=False, cpx=False, space=False):
    """式 1つ → (mode, src) のリスト"""
    out = []
    # y=f(x) (a<=x<=b) のような、括弧で範囲を添えた書き方
    m = re.match(r'^\s*(y\s*=.+?)\s*\(\s*([^()<>=]+?)\s*<=?\s*x\s*<=?\s*([^()<>=]+?)\s*\)\s*$', e)
    if m and 'x' in letters(m.group(1)):
        return [('2d', with_domain(m.group(1), m.group(2), m.group(3)))]
    L = letters(e)
    has_rel = bool(re.search(r'<=|>=|<|>|=', e))
    # f(x)=… → y=…（f, g, h の関数の定義）
    m = re.match(r'^\s*([fgh])\s*\(\s*x\s*\)\s*=\s*(.+)$', e)
    if m and 'x' in letters(m.group(2)) and 'y' not in letters(m.group(2)) and '=' not in m.group(2):
        return [('2d', f'y={m.group(2)}')]
    # ベクトル・点の定義 a=(1,2)・A=(1,2,3)
    m = re.match(r'^\s*([A-Za-zα-ω])\s*=\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$', e)
    if m and m.group(1) not in 'xyzpt':
        n = len([x for x in m.group(2).split(',') if x.strip()])
        if n == 3:
            return [('3d', e)] if (space or vecctx) else []
        if n == 2:
            return [('vector', e), ('2d-point', f'({m.group(2)})')]
    # 複素数：z を含む関係式・α=1+2i（問題文が複素数の話のときだけ）
    if cpx and 'z' in L and not ({'x', 'y'} & L) and has_rel:
        m = re.match(r'^\s*z\s*=\s*(.+)$', e)
        if m and 't' not in letters(m.group(1)) and letters(m.group(1)) - {'i'}:
            return []          # z=a+bi のような「表し方」は点として描かない
        return [('complex', e)]
    m = re.match(r'^\s*([α-ω])\s*=\s*(.+)$', e)
    if cpx and m and 'i' in letters(m.group(2)) and not ({'x', 'y', 'z'} & letters(m.group(2))):
        return [('complex', e)]
    # 空間：x, y, z を含む等式（問題文が空間図形の話のときだけ。連立方程式の x, y, z は描かない）
    if space and {'x', 'y', 'z'} <= L and '=' in e and not re.search(r'<|>', e) and 'i' not in L:
        return [('3d', e)]
    # ベクトルの式（p を使う。問題文がベクトルの記号を使っているときだけ。p は確率などにも使うため）
    if vecctx and 'p' in L and has_rel and not ({'x', 'y'} & L):
        return [('vector', e), ('3d', e)]
    # 平面：y=…、x と y の両方を含む関係式
    if has_rel and 'x' in L and 'y' in L and 'z' not in L:
        return [('2d', e)]
    if re.match(r'^\s*y\s*=', e) and 'x' in L:
        return [('2d', e)]
    return out


POINT = re.compile(CAP + r'\s*\(\s*(' + NUM + r')\s*,\s*(' + NUM + r')\s*(?:,\s*(' + NUM + r')\s*)?\)')


def candidates(tex):
    tex = str(tex or '')
    vecctx = bool(re.search(r'\\vec|\\overrightarrow', tex))
    cpx = bool(CPX.search(tex))
    space = bool(SPACE.search(tex)) or vecctx
    cands = []
    for mm in MATH.finditer(tex):
        body = next(g for g in mm.groups() if g is not None)
        # 点 A(1, 2)・A(1, 2, 3)
        for pm in POINT.finditer(body):
            name = pm.group(1) or pm.group(2)
            comps = [pm.group(k) for k in (3, 4, 5) if pm.group(k)]
            vals = [to_expr(c) for c in comps]
            if None in vals:
                continue
            tup = ', '.join(vals)
            if len(vals) == 3:
                if space:
                    cands.append(('3d', f'{name}=({tup})'))
            else:
                cands.append(('vector', f'{name}=({tup})'))
                cands.append(('2d-point', f'({tup})'))
        body_np = POINT.sub(' ', body)
        for piece in split_math(body_np):
            e = to_expr(piece)
            if not e:
                continue
            # 直前の y=f(x) に範囲 a<=x<=b を付ける（$f(x)=\sin x,\ 0\leqq x\leqq\pi$ のような書き方）
            iv = INTERVAL.match(e)
            if iv and cands and cands[-1][0] == '2d' and re.match(r'^y=', cands[-1][1]) and not re.search(r'[<>]', cands[-1][1]):
                cands[-1] = ('2d', with_domain(cands[-1][1], iv.group(1), iv.group(2)))
                continue
            for mode, src in classify(e, vecctx, cpx, space):
                cands.append((mode, src))
    # 三角形ABC・四角形ABCD・四面体ABCD：座標が与えられた点どうしを線分で結ぶ
    named = {m.group(1) for m in re.finditer(r'^\s*([A-Z])=\(', '\n'.join(src for _, src in cands), re.M)}
    shapes = []
    for m in re.finditer(r'(三角形|\\triangle|四角形|四面体|平行四辺形)\s*\$?\s*(?:\\mathrm\{)?\s*([A-Z](?:\s*[A-Z]){2,3})', tex):
        names = re.sub(r'\s', '', m.group(2))
        kind = m.group(1)
        if kind in ('三角形', '\\triangle'):
            names = names[:3]
        if not set(names) <= named:
            continue
        if kind == '四面体':
            pairs = [(a, b) for i, a in enumerate(names) for b in names[i + 1:]]
        else:
            pairs = [(names[i], names[(i + 1) % len(names)]) for i in range(len(names))]
        for a, b in pairs:
            shapes.append(f'p={a}+t({b}-{a}), 0<=t<=1')
    for src in shapes:
        for mode in ('vector', '3d'):
            cands.append((mode, src))
    seen, out = set(), []
    for mode, src in cands:
        if (mode, src) in seen:
            continue
        seen.add((mode, src))
        out.append({'mode': mode, 'src': src})
    return out


def main():
    content = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'content'
    out = {}
    for f in sorted((content / 'problems').glob('*.json')):
        if f.name == 'builtin.json':
            continue
        for p in json.loads(f.read_text(encoding='utf-8')):
            tex = (p.get('statement') or {}).get('tex') or ''
            c = candidates(tex)
            if not c:
                continue
            out[p['id']] = {'after': bool(AFTER.search(tex)), 'h': hashlib.sha1(tex.encode('utf-8')).hexdigest()[:12], 'cands': c}
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == '__main__':
    main()
