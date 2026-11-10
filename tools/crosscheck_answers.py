#!/usr/bin/env python3
"""入力用の答えを、元の「答え」（LaTeX）と SymPy で独立に照合する。

入力用の答えに出てくる値・範囲の端の数・場合分けの値を1つずつ取り出し、
元の答えの数式のどれかと数値的に一致するかを調べる。一致しない小問は「記述」に戻す候補として出力する。

    python3 tools/crosscheck_answers.py rows.json specs.json mismatches.json
"""
import json
import random
import re
import sys
import warnings

warnings.filterwarnings('ignore')
from sympy import N, Symbol, pi, E, sqrt, sympify, Expr
from sympy.parsing.latex import parse_latex
from sympy.parsing.sympy_parser import (parse_expr, standard_transformations,
                                        implicit_multiplication_application, convert_xor, split_symbols)

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from make_input_answers import split_answer, split_top  # noqa: E402

GREEK_NAME = {'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'θ': 'theta', 'φ': 'phi', 'ω': 'omega',
              'λ': 'lambda_', 'μ': 'mu', 'ρ': 'rho', 'σ': 'sigma', 'τ': 'tau', 'ψ': 'psi', 'ξ': 'xi', 'η': 'eta',
              'ζ': 'zeta', 'κ': 'kappa', 'ν': 'nu', 'ε': 'epsilon'}
TRANS = standard_transformations + (convert_xor, split_symbols, implicit_multiplication_application)


# ---------------------------------------------------------------- 元の LaTeX → SymPy
def brace_args(t):
    """\\frac12 → \\frac{1}{2}、\\sqrt3 → \\sqrt{3}、x^2 はそのまま"""
    out, i, n = [], 0, len(t)

    def arg(i):
        while i < n and t[i] == ' ':
            i += 1
        if i >= n:
            return '{}', i
        if t[i] == '{':
            d = 0
            for j in range(i, n):
                if t[j] == '{':
                    d += 1
                elif t[j] == '}':
                    d -= 1
                    if d == 0:
                        return '{' + brace_args(t[i + 1:j]) + '}', j + 1
        if t[i] == '\\':
            m = re.match(r'\\[a-zA-Z]+', t[i:])
            if m:
                return '{' + m.group(0) + '}', i + m.end()
        return '{' + t[i] + '}', i + 1

    while i < n:
        m = re.match(r'\\(d?t?frac|cfrac)', t[i:])
        if m:
            i += m.end()
            a, i = arg(i)
            b, i = arg(i)
            out.append('\\frac' + a + b)
            continue
        m = re.match(r'\\sqrt', t[i:])
        if m:
            i += m.end()
            idx = ''
            if i < n and t[i] == '[':
                j = t.index(']', i)
                idx = t[i:j + 1]
                i = j + 1
            a, i = arg(i)
            out.append('\\sqrt' + idx + a)
            continue
        out.append(t[i])
        i += 1
    return ''.join(out)


def clean_tex(t):
    t = re.sub(r'\\(left|right|bigl|bigr|Bigl|Bigr|displaystyle|boldsymbol|mathrm|,|;|!|quad|qquad)\b\s*', ' ', t)
    t = re.sub(r'\\text\{[^}]*\}', ',', t)
    t = t.replace('\\ ', ' ').replace('\\dfrac', '\\frac').replace('\\tfrac', '\\frac')
    t = t.replace('\\leqq', '\\le').replace('\\geqq', '\\ge').replace('\\cdot', '\\times')
    t = re.sub(r'\^\s*\{?\\circ\}?', '', t)
    t = t.replace('\\{', '(').replace('\\}', ')')
    t = re.sub(r'\\(pi|varphi|phi|theta|alpha|beta)\s*\(', r'\\\1 \\times (', t)
    t = re.sub(r'(?<![\\a-zA-Z])([a-zA-Z0-9}])\s*\(', r'\1 \\times (', t)   # n(n-1) は掛け算
    return brace_args(t).strip()


def wraps_whole(p):
    if not (p.startswith('(') and p.endswith(')')):
        return False
    d = 0
    for i, c in enumerate(p):
        d += c == '('
        d -= c == ')'
        if d == 0 and i < len(p) - 1:
            return False
    return True


def fix_consts(e):
    return e.subs({Symbol('pi'): pi, Symbol('e'): E, Symbol('varphi'): Symbol('phi'), Symbol('vartheta'): Symbol('theta'),
                   Symbol('varepsilon'): Symbol('epsilon')})


def tex_values(part_text):
    """元の小問の答えから、数式の値の候補をすべて取り出す"""
    out = []
    maths = []
    for m in re.findall(r'\$([^$]+)\$', part_text):
        maths.append(m)
        if '\\pm' in m or '\\mp' in m:
            maths.append(m.replace('\\pm', '+').replace('\\mp', '-'))
            maths.append(m.replace('\\pm', '-').replace('\\mp', '+'))
    for m in maths:
        m = clean_tex(m)
        pieces = []
        for seg in split_top(m, [',', '，']):
            pieces.extend(re.split(r'\\le|\\ge|<|>|=|\\neq|&|\\\\|:', seg))
        expanded = []
        for p in pieces:
            p = p.strip()
            if wraps_whole(p) and ',' in p:
                expanded.extend(split_top(p[1:-1], [',']))
            elif wraps_whole(p):
                expanded.append(p[1:-1])
            else:
                expanded.append(p)
        for p in expanded:
            p = p.strip()
            if not p or not re.search(r'[0-9a-zA-Z\\]', p):
                continue
            for cand in (p, p.lstrip('-')):
                try:
                    out.append(fix_consts(parse_latex(cand)))
                except Exception:
                    pass
            if '\\pm' in seg or '\\mp' in seg:
                pass
        # ± の両方
        for pm in re.findall(r'([^=,<>]*)\\(?:pm|mp)([^=,<>]*)', m):
            for sgn in ('+', '-'):
                try:
                    out.append(fix_consts(parse_latex(f'{pm[0]}{sgn}{pm[1]}')))
                except Exception:
                    pass
    for m in re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)(?![\d.])', re.sub(r'\$[^$]*\$', ' ', part_text)):
        out.append(sympify(m))
    return [c for c in out if isinstance(c, Expr)]


# ---------------------------------------------------------------- 入力用の答え → SymPy
def plain_to_sympy(s):
    s = s.strip()
    s = re.sub(r'(個|通り|桁|本|人|回|枚|組|点|色|日|番目|倍|種類|°)$', '', s)
    for g, name in GREEK_NAME.items():
        s = s.replace(g, f' {name} ')
    s = s.replace('π', ' pi ').replace('√', 'sqrt')
    s = re.sub(r'\|([^|]+)\|', r'Abs(\1)', s)
    funcs = {'sqrt', 'sin', 'cos', 'tan', 'log', 'exp', 'Abs', 'pi', 'E', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
             'alpha', 'beta', 'gamma', 'delta', 'theta', 'phi', 'omega', 'lambda_', 'mu', 'rho', 'sigma', 'tau', 'psi', 'xi',
             'eta', 'zeta', 'kappa', 'nu', 'epsilon'}
    # アプリの書式では e はいつも定数、文字の並びは掛け算
    s = re.sub(r'[A-Za-z_]+', lambda m: m.group(0) if m.group(0) in funcs else '*'.join('E' if ch == 'e' else ch for ch in m.group(0)), s)
    s = re.sub(r'(\bpi\b|\bE\b|(?<![a-zA-Z])[a-zA-Z](?![a-zA-Z]))\s*\(', r'\1*(', s)   # π(…)、h(…) は掛け算
    s = re.sub(r'(?<![a-zA-Z])([a-zA-Z])\s+(?=sin|cos|tan|log|exp|sqrt)', r'\1*', s)
    return parse_expr(s, transformations=TRANS, local_dict={'E': E, 'pi': pi, 'sqrt': sqrt, 'lambda_': Symbol('lambda')})


def atoms_of_field(f):
    """フィールドの書式から、照合する値（文字列）を取り出す"""
    lab, sep, val = f.rpartition('：') if '：' in f and not f.startswith('場合分け') else ('', '', f)
    val = val.strip()
    if re.match(r'^(証明|図示|記述)', val):
        return None
    cm = re.match(r'^場合分け\{(.*)\}$', val)
    if cm:
        out = []
        for c in split_top(cm.group(1), [' | ']):
            cond, _, v = re.split(r'(→)', c, maxsplit=1)
            out.append(v.strip())
            out.extend(x for x in re.split(r'<=|>=|<|>|=|≠| または | かつ ', cond) if x.strip() and re.search(r'\d', x))
        return out
    if val.startswith('{'):
        items = split_top(val[1:-1], [','])
        out = []
        for it in items:
            out.extend(split_top(it.strip()[1:-1], [',']) if it.strip().startswith('(') and ',' in it else [it])
        return out
    if re.match(r'^\d+(:\d+)+$', val):
        return val.split(':')
    if re.search(r'<|>|≠| または | かつ ', val):
        return [x for x in re.split(r'<=|>=|<|>|≠| または | かつ ', val) if x.strip() and re.search(r'[\dπ]|sqrt', x)]
    if val.startswith('(') and ',' in val and split_top(val[1:-1], [',']).__len__() > 1:
        return split_top(val[1:-1], [','])
    return [val]


def same(a, b):
    syms = sorted(a.free_symbols | b.free_symbols, key=str)
    names = {}
    for s in syms:
        names.setdefault(str(s), []).append(s)
    for _ in range(3):
        vals = {name: random.uniform(0.3, 2.2) for name in names}
        sub = {s: vals[str(s)] for s in syms}
        try:
            x, y = complex(N(a.subs(sub))), complex(N(b.subs(sub)))
        except Exception:
            return False
        if abs(x - y) > 1e-6 * max(1, abs(x)):
            return False
    return True


def main():
    rows = {r[0]: r for r in json.load(open(sys.argv[1]))}
    specs = json.load(open(sys.argv[2]))
    bad, checked, unverifiable = {}, 0, 0
    detail = {}
    for pid, v in specs.items():
        if not v.get('spec'):
            continue
        parts = split_answer(rows[pid][8])
        lines = v['spec'].split('\n')
        for k, line in enumerate(lines):
            body = re.sub(r'^\(\d+\)\s*', '', line)
            ptext = parts[k][1] if k < len(parts) else rows[pid][8]
            cands = None
            for f in split_top(body, [' ; ']):
                atoms = atoms_of_field(f)
                if not atoms:
                    continue
                if cands is None:
                    cands = tex_values(ptext)
                for a in atoms:
                    checked += 1
                    try:
                        sa = plain_to_sympy(a)
                        if not isinstance(sa, Expr):
                            raise ValueError
                    except Exception:
                        unverifiable += 1
                        bad.setdefault(pid, []).append(k)   # 照合できないものも安全のため自己採点に戻す
                        detail[f'{pid}#{k + 1}'] = f'（照合できない）{a}'
                        break
                    if not any(same(sa, c) or same(-sa, c) for c in cands):
                        bad.setdefault(pid, []).append(k)
                        detail[f'{pid}#{k + 1}'] = f'{a}  ｜ 元：{ptext[:120]}'
                        break
                else:
                    continue
                break
    for pid in bad:
        bad[pid] = sorted(set(bad[pid]))
    json.dump(bad, open(sys.argv[3], 'w'), ensure_ascii=False, indent=0)
    json.dump(detail, open(sys.argv[3].replace('.json', '-detail.json'), 'w'), ensure_ascii=False, indent=0)
    print(f'照合した値 {checked}（SymPy で読めず照合できない {unverifiable}）')
    print(f'元の答えと一致しない小問 {sum(len(x) for x in bad.values())}（{len(bad)}問）')


if __name__ == '__main__':
    random.seed(1)
    main()
