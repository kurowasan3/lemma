#!/usr/bin/env python3
"""問題の答えを SymPy で独立に計算し直して照合する（自動検証）。問題データは書きかえない。

  python3 tools/verify_math.py                # 検証して要約を出す
  python3 tools/verify_math.py --write        # 結果を content/quality/auto.json に保存する（品質管理の記録。学習記録とは別）
  python3 tools/verify_math.py --status       # 保存した結果が今のデータと合っているか（内容が変わった問題）だけを見る（速い）
  python3 tools/verify_math.py --id B-SEQ-009 # 1問だけ詳しく

■ 自動で確かめること（小問ごと。当てはまらない小問は「対象外」）
  定積分  … 小問に定積分が1つだけあり、被積分関数・端が数で決まり、「求めよ／計算せよ」のとき、SymPy で積分して答えと照合
  極限    … 小問に \\lim が1つだけあり、式が極限の変数だけで書けるとき、SymPy の limit と照合
  漸化式  … a_1（と a_2）と a_{n+1}=…（a_{n+2}=…）の形で「一般項を求めよ」のとき、答えの式が初項と漸化式を満たすかを照合
           （記号計算で 0 になれば「記号計算で一致」。ならなければ n=1〜12 の値で照合し「数値で一致（証明ではない）」）
  方程式  … 「方程式 … を解け」で x の方程式が1つのとき、SymPy で解いた解の集合と答えを照合。
           SymPy が解の集合を出せなければ、答えの値を代入して方程式を満たすかだけを見る（「すべての解かは未確認」）
■ 結果
  pass-symbolic … 記号計算で答えの値が一致
  pass-numeric  … 数値でだけ一致（数値の一致は証明ではない）
  partial       … 答えの値は条件を満たすが、それで全部かは未確認
  fail          … 計算し直した値と答えが合わない（答えか問題文の読み取りの誤り。人が確認する）
  na            … 自動検証の対象外（証明・説明・図形・場合の数・読み取れない形 など）
■ 構造の検査（数学的な検証ではなく、問題文と答えの形の不整合の候補）
  小問と答えの数が合わない・小問に要求（求めよ・示せ など）が読み取れない・答えに問題文に無い文字が出てくる（条件不足の候補）

自動検証は「答えの値」を確かめるだけで、解答の論理・場合分けの網羅・必要十分・解説の十分さは確かめない。
自動検証に合格しても、人による数学的確認とは別に扱う（content/quality/human.json・管理表の「検証:人間確認」）。
"""
import json, re, sys, signal, hashlib, datetime, warnings
from pathlib import Path

warnings.filterwarnings('ignore')
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_input_answers import tex2expr, group, split_answer, question_items, Fail  # noqa: E402
from crosscheck_answers import plain_to_sympy  # noqa: E402
import sympy as sp  # noqa: E402

TOOL = 'verify_math 2'   # 2：小問は入れ子を除いた最上位の \item だけ数える・要求の言葉を足した（v0.27）
OUT = ROOT / 'content' / 'quality' / 'auto.json'
REQUEST = re.compile(r'入れ|\\fbox|空欄|求め|示せ|示し|証明|答え|計算|解け|せよ|述べ|調べ|表せ|定め|何通り|いくつ|何個|何本|何|どれ|か[。．.?？）)]|か$|図示|描け|書け|判定|比べ|与えよ|挙げ'
                     r'|確かめ|かけ[。．]|えがけ|導け|並べ|特徴づけ|なさい|あげよ|言い換え|例を|答えよ|選べ|作れ|決定|てみよう')
RESULT_JA = {'pass-symbolic': '記号計算で一致', 'pass-numeric': '数値で一致（証明ではない）', 'partial': '答えは条件を満たす（すべてかは未確認）',
             'fail': '不一致', 'na': '対象外'}


class Timeout(Exception):
    pass


def _alarm(signum, frame):
    raise Timeout()


def limited(fn, sec=8):
    signal.signal(signal.SIGALRM, _alarm)
    signal.alarm(sec)
    try:
        return fn()
    finally:
        signal.alarm(0)


def content_hash(p):
    s = '\n'.join([p['statement']['tex'], p.get('answer', {}).get('tex', ''), *[x.get('tex', '') for x in p.get('solutions', [])], p.get('idea', {}).get('tex', '')])
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:12]


def maths(t):
    return re.findall(r'\$([^$]+)\$', t or '')


def to_sym(tex):
    """LaTeX の数式 → SymPy。読めなければ Fail"""
    t = tex.strip().rstrip('．。.,，')
    try:
        return plain_to_sympy(tex2expr(t))
    except Fail:
        raise
    except Exception as e:  # noqa: BLE001
        raise Fail(str(e)[:60])


def answer_value(a):
    """小問の答えから値を1つ取り出す（式が1つだけで、ほかに語句が無いとき）。取り出せなければ None"""
    ms = maths(a)
    rest = re.sub(r'\$[^$]+\$', '', a).strip(' 　．。.,，')
    if len(ms) != 1 or rest:
        return None
    m = re.sub(r'^\s*[A-Za-z](?:_\{?n\}?)?\s*=\s*', '', ms[0])   # 「a_n=」「I=」などの左辺を外す
    if '=' in m or '\\le' in m or '\\ge' in m or '<' in m or '>' in m or ',' in m:
        return None
    return m


def same_value(x, y):
    """('symbolic'|'numeric'|None, 説明)"""
    try:
        d = limited(lambda: sp.simplify(x - y), 6)
        if d == 0:
            return 'symbolic', ''
    except (Timeout, Exception):  # noqa: BLE001
        pass
    try:
        vx, vy = complex(sp.N(x, 30)), complex(sp.N(y, 30))
        if abs(vx - vy) <= 1e-9 * (1 + abs(vx)):
            return 'numeric', ''
        return None, f'計算 {sp.N(x, 12)}・答え {sp.N(y, 12)}'
    except Exception:  # noqa: BLE001
        return 'na', '数値にできない'   # 比べられないものは不一致にしない（対象外）


# ---------------------------------------------------------------- 定積分
INT = re.compile(r'\\int\s*_')


def check_integral(q, a, ctx=''):
    kw = q + ' ' + ctx   # 要求の言葉は小問の前の文（「次の定積分を求めよ」）も見る。数式は小問の中だけ
    if len(INT.findall(q)) != 1 or not re.search(r'求めよ|計算せよ', kw) or re.search(r'[fgFGS]\s*\(', q) or '\\lim' in q or '\\sum' in q:
        return None
    if re.search(r'示せ|証明|最大|最小|範囲|関数', kw):
        return None
    ms = [m for m in maths(q) if '\\int' in m]
    if len(ms) != 1:
        return None
    m = ms[0]
    k = m.index('\\int') + 4
    m2 = m[k:].lstrip()
    if not m2.startswith('_'):
        return None
    lo, i = group(m2, 1)
    if m2[i:i + 1] != '^':
        return None
    hi, i = group(m2, i + 1)
    body = m2[i:]
    mm = re.search(r'\\?,?\s*d\s*([a-z])\s*$', body.strip())
    if not mm:
        return None
    var = mm.group(1)
    body = body.strip()[:mm.start()].strip()
    av = answer_value(a)
    if av is None:
        return None
    try:
        lo_e, hi_e, f, ans = to_sym(lo), to_sym(hi), to_sym(body), to_sym(av)
    except Fail:
        return None
    x = sp.Symbol(var)
    if (f.free_symbols - {x}) or lo_e.free_symbols or hi_e.free_symbols or ans.free_symbols:
        return None
    try:
        val = limited(lambda: sp.integrate(f, (x, lo_e, hi_e)), 12)
    except (Timeout, Exception):  # noqa: BLE001
        return None
    if val.has(sp.Integral):
        return None
    how, detail = same_value(val, ans)
    if how == 'na':
        return None
    return {'kind': '定積分', 'result': f'pass-{how}' if how else 'fail', 'detail': detail}


# ---------------------------------------------------------------- 極限
LIM = re.compile(r'\\lim\s*_\s*\{\s*([a-z])\s*\\to\s*([^}]*)\}')


def check_limit(q, a, ctx=''):
    kw = q + ' ' + ctx   # 要求の言葉は小問の前の文（「次の定積分を求めよ」）も見る。数式は小問の中だけ
    if len(re.findall(r'\\lim', q)) != 1 or not re.search(r'求めよ', kw) or re.search(r'示せ|証明|範囲|(?<![a-zA-Z\\])[A-Za-z]\s*\(|\\sum|\\int|a_|S_|I_|J_', q):
        return None
    ms = [m for m in maths(q) if '\\lim' in m]
    if len(ms) != 1:
        return None
    m = ms[0]
    mm = LIM.search(m)
    if not mm:
        return None
    var, to = mm.group(1), mm.group(2).strip()
    body = m[mm.end():].strip()
    if '=' in body:
        return None
    av = answer_value(a)
    if av is None:
        return None
    sgn = ''
    if to.endswith('+0') or to.endswith('-0'):
        sgn = to[-2]
        to = to[:-2] or '0'
    try:
        to_e = sp.oo if to in ('\\infty', '+\\infty') else -sp.oo if to == '-\\infty' else to_sym(to)
        f, ans = to_sym(body), to_sym(av.replace('\\infty', 'oo')) if '\\infty' not in av else (sp.oo if not av.strip().startswith('-') else -sp.oo)
    except Fail:
        return None
    x = sp.Symbol(var)
    if f.free_symbols - {x} or getattr(ans, 'free_symbols', set()):
        return None
    try:
        val = limited(lambda: sp.limit(f, x, to_e, dir=sgn or '+-') if to_e not in (sp.oo, -sp.oo) else sp.limit(f, x, to_e), 12)
    except (Timeout, Exception):  # noqa: BLE001
        return None
    if isinstance(val, sp.Limit) or val.has(sp.Limit) or val == sp.nan:
        return None
    if val in (sp.oo, -sp.oo, sp.zoo) or ans in (sp.oo, -sp.oo):
        return {'kind': '極限', 'result': 'pass-symbolic' if val == ans else 'fail', 'detail': '' if val == ans else f'計算 {val}・答え {ans}'}
    how, detail = same_value(val, ans)
    if how == 'na':
        return None
    return {'kind': '極限', 'result': f'pass-{how}' if how else 'fail', 'detail': detail}


# ---------------------------------------------------------------- 漸化式
# a_{n+2}・a_{n+1}・a_n を、問題文に出てこないギリシャ文字に置きかえて読む（数字つきの名前は掛け算に読まれるため）
REC_SYM = {'\\zeta': 'zeta', '\\eta': 'eta', '\\xi': 'xi'}


def _rec_tokens(t):
    t = re.sub(r'a_\{n\+2\}', r' \\zeta ', t)
    t = re.sub(r'a_\{n\+1\}', r' \\eta ', t)
    t = re.sub(r'a_\{?n\}?', r' \\xi ', t)
    return t


def check_recurrence(q, a, ctx=''):
    kw = q + ' ' + ctx   # 要求の言葉は小問の前の文（「次の定積分を求めよ」）も見る。数式は小問の中だけ
    if not re.search(r'一般項', kw) or re.search(r'示せ|証明|S_|b_|c_|\\sum', q):
        return None
    ms = maths(q)
    init, rhs1, rhs2 = {}, None, None
    for m in ms:
        for part in re.split(r',\s*(?:\\\s)?|，|\\quad|\\ ', m):
            part = part.strip()
            mi = re.match(r'^a_\{?([12])\}?\s*=\s*(.+)$', part)
            if mi:
                init[int(mi.group(1))] = mi.group(2)
                continue
            mr = re.match(r'^a_\{n\+([12])\}\s*=\s*(.+)$', part)
            if mr:
                if mr.group(1) == '1': rhs1 = mr.group(2)
                else: rhs2 = mr.group(2)
            elif 'a_' in part and '=' in part:
                return None   # (n+1)a_{n+1}=… など、解いていない形は対象外
    if 1 not in init or (rhs1 is None) == (rhs2 is None) or (rhs2 is not None and 2 not in init):
        return None
    av = answer_value(a)
    if av is None:
        return None
    n = sp.Symbol('n', integer=True, positive=True)
    A0, A1 = sp.Symbol('xi'), sp.Symbol('eta')
    try:
        f = to_sym(av)
        a1 = to_sym(init[1]); a2 = to_sym(init[2]) if 2 in init else None
        rhs_src = rhs2 if rhs2 is not None else rhs1
        if re.search(r'\\(xi|eta|zeta)', rhs_src):
            return None
        rhs = plain_to_sympy(tex2expr(_rec_tokens(rhs_src)))
    except Fail:
        return None
    except Exception:  # noqa: BLE001
        return None
    nn = sp.Symbol('n')
    f = f.subs(nn, n)
    rhs = rhs.subs(nn, n)
    syms = f.free_symbols | rhs.free_symbols
    if syms - {n, A0, A1}:
        return None
    if f.subs(n, 1) - a1 != 0 and sp.simplify(f.subs(n, 1) - a1) != 0:
        return {'kind': '漸化式', 'result': 'fail', 'detail': f'初項：答えの式で a_1={sp.simplify(f.subs(n, 1))}・問題は {a1}'}
    if a2 is not None and sp.simplify(f.subs(n, 2) - a2) != 0:
        return {'kind': '漸化式', 'result': 'fail', 'detail': f'第2項：答えの式で a_2={sp.simplify(f.subs(n, 2))}・問題は {a2}'}
    if rhs2 is not None:
        lhs, r = f.subs(n, n + 2), rhs.subs({A1: f.subs(n, n + 1), A0: f})
    else:
        lhs, r = f.subs(n, n + 1), rhs.subs({A0: f})
    try:
        d = limited(lambda: sp.simplify(sp.expand(lhs - r)), 8)
        if d == 0:
            return {'kind': '漸化式', 'result': 'pass-symbolic', 'detail': ''}
    except (Timeout, Exception):  # noqa: BLE001
        pass
    try:
        for k in range(1, 13):
            v = complex(sp.N((lhs - r).subs(n, k), 30))
            if abs(v) > 1e-9 * (1 + abs(complex(sp.N(lhs.subs(n, k), 30)))):
                return {'kind': '漸化式', 'result': 'fail', 'detail': f'n={k} で漸化式を満たさない'}
    except Exception:  # noqa: BLE001
        return None
    return {'kind': '漸化式', 'result': 'pass-numeric', 'detail': 'n=1〜12 で一致'}


# ---------------------------------------------------------------- 方程式
def _answer_values(a, var='x'):
    ms = maths(a)
    rest = re.sub(r'\$[^$]+\$', '', a).strip(' 　．。.,，')
    if len(ms) != 1 or rest:
        return None
    m = ms[0].strip()
    m = re.sub(rf'^{var}\s*=\s*', '', m)
    if re.search(r'\\le|\\ge|<|>|\\text|=', m):
        return None
    out = []
    for part in re.split(r',\s*(?:\\\s)?|，|\\quad', m):
        part = part.strip().replace('\\ ', '')
        if not part:
            continue
        if '\\pm' in part:
            out += [part.replace('\\pm', '+', 1), part.replace('\\pm', '-', 1)]
        else:
            out.append(part)
    return out


def check_equation(q, a, ctx=''):
    kw = q + ' ' + ctx   # 要求の言葉は小問の前の文（「次の定積分を求めよ」）も見る。数式は小問の中だけ
    if not re.search(r'方程式', kw) or not re.search(r'解け', kw) or re.search(r'不等式|示せ|証明|範囲|[fgFG]\s*\(|y', q):
        return None
    ms = [m for m in maths(q) if '=' in m]
    if len(ms) != 1:
        return None
    lhs, _, rhs = ms[0].partition('=')
    if '=' in rhs or '\\' in rhs and '\\frac' not in rhs and '\\sqrt' not in rhs and '\\dfrac' not in rhs:
        pass
    vals = _answer_values(a)
    if not vals:
        return None
    try:
        L, R = to_sym(lhs), to_sym(rhs)
        xs = [to_sym(v) for v in vals]
    except Fail:
        return None
    x = sp.Symbol('x')
    eq = L - R
    if eq.free_symbols - {x} or any(v.free_symbols for v in xs):
        return None
    complex_ans = any(v.has(sp.I) for v in xs)
    for v in xs:
        try:
            r = limited(lambda: sp.simplify(eq.subs(x, v)), 6)
        except (Timeout, Exception):  # noqa: BLE001
            r = None
        if r != 0:
            try:
                if abs(complex(sp.N(eq.subs(x, v), 30))) > 1e-9:
                    return {'kind': '方程式', 'result': 'fail', 'detail': f'答えの x={v} が方程式を満たさない'}
            except Exception:  # noqa: BLE001
                return None
    try:
        S = limited(lambda: sp.solveset(sp.Eq(L, R), x, sp.S.Complexes if complex_ans else sp.S.Reals), 10)
    except (Timeout, Exception):  # noqa: BLE001
        S = None
    if isinstance(S, sp.FiniteSet):
        sol = list(S)
        def has(lst, v):
            return any(same_value(v, w)[0] in ('symbolic', 'numeric') for w in lst)
        if all(has(xs, s) for s in sol) and all(has(sol, v) for v in xs):
            return {'kind': '方程式', 'result': 'pass-symbolic', 'detail': f'解 {len(sol)}個'}
        missing = [s for s in sol if not has(xs, s)]
        return {'kind': '方程式', 'result': 'fail', 'detail': f'答えに無い解 {missing[:3]}' if missing else '答えに解でない値'}
    return {'kind': '方程式', 'result': 'partial', 'detail': '答えの値は方程式を満たす（解の集合は SymPy で求まらず、すべての解かは未確認）'}


CHECKERS = [check_integral, check_limit, check_recurrence, check_equation]


# ---------------------------------------------------------------- 構造の検査
KNOWN = set('xyztnkmijeπθ') | {'i'}


def items_of(st):
    """小問の文：最上位の enumerate の \\item だけ（入れ子の enumerate・itemize は親の小問の文に含める）。
    条件を並べるだけの enumerate（[label=…] つき）と itemize は小問に数えない（v0.27）"""
    # [label=…] の enumerate は条件の列挙。[resume]・[start=…] は小問の続き（例：(1) のあとに文が入り (2)(3) が続く）なので残す
    st = re.sub(r'\\begin\{enumerate\}\[(?![^\]]*(?:resume|start))[^\]]*\].*?\\end\{enumerate\}', ' ', st, flags=re.S)
    out, stack, cur = [], [], None
    for m in re.finditer(r'\\(begin|end)\{(enumerate|itemize)\}|\\item(?!\[)', st):
        if m.group(1) == 'begin':
            stack.append(m.group(2))
        elif m.group(1) == 'end':
            if stack: stack.pop()
            if not stack and cur is not None:
                out.append(st[cur:m.start()]); cur = None
        elif stack == ['enumerate']:   # 最上位の enumerate の \\item
            if cur is not None: out.append(st[cur:m.start()])
            cur = m.end()
    return out


def block_sizes(st):
    """最上位の enumerate ごとの小問の数（[resume]・[start=…] は前の enumerate に続けて数える）"""
    st = re.sub(r'\\begin\{enumerate\}\[(?![^\]]*(?:resume|start))[^\]]*\].*?\\end\{enumerate\}', ' ', st, flags=re.S)
    sizes, depth = [], 0
    for m in re.finditer(r'\\begin\{(enumerate|itemize)\}(\[[^\]]*\])?|\\end\{(?:enumerate|itemize)\}|\\item(?!\[)', st):
        t = m.group(0)
        if t.startswith('\\begin'):
            if depth == 0 and m.group(1) == 'enumerate':
                cont = (m.group(2) and re.search(r'resume|start', m.group(2))) or re.match(r'\s*\\setcounter\{enumi\}', st[m.end():])
                if not (cont and sizes): sizes.append(0)
            depth += 1
        elif t.startswith('\\end'):
            depth -= 1
        elif depth == 1 and sizes:
            sizes[-1] += 1
    return sizes


def lint(p):
    st, an = p['statement']['tex'], p.get('answer', {}).get('tex', '')
    out = []
    qi, ai = items_of(st), split_answer(an)
    # [I][II] のように、enumerate ごとに (1) から数え直す問題：答えの番号は、いちばん大きい区切りの数までを見る
    sizes = block_sizes(st)
    nq = max(sizes) if len(sizes) > 1 else len(qi)
    labels = {int(x) for x in re.findall(r'\((\d)\)', re.sub(r'\$[^$]*\$', ' ', an))}
    if qi and not labels:
        out.append('小問があるのに答えが小問ごとに分かれていない')
    elif qi:
        miss = [k for k in range(1, nq + 1) if k not in labels]
        more = sorted(k for k in labels if k > nq)
        if miss:
            out.append('答えの無い小問 ' + '・'.join(f'({k})' for k in miss) + '（図示などで答えを書いていないか、答えの抜け）')
        if more:
            out.append(f'小問は {nq}つなのに、答えに ' + '・'.join(f'({k})' for k in more) + ' がある（小問の区切りの誤りの候補）')
    stem = re.split(r'\\begin\{enumerate\}', st)[0]
    tail = re.split(r'\\end\{enumerate\}', st)[-1] if qi else ''
    for k, t in enumerate(qi or [st], start=1):
        if '\\fbox' in t + stem + tail:   # 空欄補充（\fbox は数式の中に書かれる）
            continue
        if not REQUEST.search(re.sub(r'\$[^$]*\$', ' ', t)) and not REQUEST.search(re.sub(r'\$[^$]*\$', ' ', stem + tail)):
            out.append(f'小問{k if qi else ""}に要求（求めよ・示せ など）が読み取れない'.replace('小問に', '問題文に'))
    # 答えに出てくる1文字の文字のうち、問題文に無いもの（条件不足・記号の未定義の候補）
    def letters(t, plain=False):
        s = ' '.join(maths(t)) + (' ' + re.sub(r'\$[^$]*\$', ' ', t) if plain else '')
        s = re.sub(r'\\(?:text|mathrm|operatorname)\{[^}]*\}', ' ', s)
        s = re.sub(r'\\(?:angle|mathrm|triangle)\s*[A-Za-z]+', ' ', s)   # ∠B・\mathrm B（図形の点の名前）
        s = re.sub(r'\\[a-zA-Z]+', ' ', s)
        return set(re.findall(r'(?<![A-Za-z])([A-Za-z])(?![A-Za-z])', s))
    extra = sorted(letters(an) - letters(st, True) - letters(' '.join(x.get('tex', '') for x in p.get('solutions', [])), True) - KNOWN)
    if extra:
        out.append('答えに問題文と解説に無い文字 ' + '・'.join(extra) + '（条件不足・記号の未定義の候補）')
    return out


def verify(p):
    """1問の自動検証。{'items': [...], 'lint': [...]}"""
    st, an = p['statement']['tex'], p.get('answer', {}).get('tex', '')
    qi, ai = items_of(st), split_answer(an)
    pairs = []
    if qi and len(qi) == len(ai):
        pairs = [(lab or str(k), q, a) for k, (q, (lab, a)) in enumerate(zip(qi, ai), start=1)]
    elif not qi and len(ai) == 1:
        pairs = [('', st, ai[0][1])]
    stem = re.split(r'\\begin\{enumerate\}', st)[0] if qi else ''
    items = []
    proof_all = re.search(r'示せ|証明せよ', st) and not re.search(r'求めよ', st)
    for lab, q, a in pairs:
        res = None
        if not re.search(r'示せ|証明せよ', q):
            for ch in CHECKERS:
                try:
                    res = ch(q, a, stem)
                except (Timeout, Fail):
                    res = None
                except Exception:  # noqa: BLE001
                    res = None
                if res:
                    break
        items.append({'i': lab, **(res or {'kind': '', 'result': 'na', 'detail': '証明・説明' if re.search(r'示せ|証明せよ', q) else ''})})
    if not items:
        items = [{'i': '', 'kind': '', 'result': 'na', 'detail': '証明・説明' if proof_all else '小問と答えを対応づけられない'}]
    return {'items': items, 'lint': lint(p)}


NA_ITEMS = [{'i': '', 'kind': '', 'result': 'na', 'detail': ''}]


def summary(rec):
    """問題ごとの自動検証の状態：issue（不一致あり）・pass（全小問が一致）・partial（一部の小問だけ一致・または全部かは未確認）・na（すべて対象外）"""
    rs = [x['result'] for x in rec.get('items', NA_ITEMS)]
    if 'fail' in rs:
        return 'issue'
    ok = [r for r in rs if r.startswith('pass') or r == 'partial']
    if not ok:
        return 'na'
    if len(ok) == len(rs) and all(r.startswith('pass') for r in rs):
        return 'pass'
    return 'partial'


def load(root=ROOT):
    ps = []
    for f in sorted((root / 'content' / 'problems').glob('*.json')):
        if f.name == 'builtin.json':
            continue
        ps += json.loads(f.read_text(encoding='utf-8'))
    return [p for p in ps if p['quality']['status'] == 'published']


def main():
    args = sys.argv[1:]
    ps = load()
    if '--status' in args:
        if not OUT.exists():
            print('自動検証の記録がありません（python3 tools/verify_math.py --write）'); return 0
        rec = json.loads(OUT.read_text(encoding='utf-8'))
        cur = {p['id']: content_hash(p) for p in ps}
        stale = [i for i, r in rec['results'].items() if i in cur and r['h'] != cur[i]]
        gone = [i for i in rec['results'] if i not in cur]
        new = [i for i in cur if i not in rec['results']]
        print(f"自動検証の記録（{rec['tool']}・{rec['date']}）：{len(rec['results'])}問。内容が変わった問題 {len(stale)}・記録の無い問題 {len(new)}・データに無い問題 {len(gone)}")
        if stale[:10]: print('  内容が変わった：' + ' '.join(stale[:10]))
        return 0
    if '--id' in args:
        pid = args[args.index('--id') + 1]
        p = next((x for x in ps if x['id'] == pid), None)
        if not p:
            print('その問題はありません'); return 1
        r = verify(p)
        for it in r['items']:
            print(f"  ({it['i'] or '-'}) {it['kind'] or '-'}：{RESULT_JA[it['result']]} {it['detail']}")
        for l in r['lint']:
            print('  構造：' + l)
        return 0
    old = json.loads(OUT.read_text(encoding='utf-8'))['results'] if OUT.exists() else {}
    today = datetime.date.today().isoformat()
    results, cnt, kinds, lints = {}, {}, {}, 0
    for p in ps:
        r = verify(p)
        h = content_hash(p)
        prev = old.get(p['id'])
        same = prev and prev['h'] == h and summary(prev) == summary(r) and (prev.get('items') in (None, r['items'])) and prev.get('lint', []) == r['lint']
        at = prev['at'] if same else today
        # すべて対象外で構造の候補も無い問題は、照合用の値と日付だけを残す（ファイルを小さく）
        results[p['id']] = {'h': h, 'at': at} if summary(r) == 'na' and not r['lint'] else {'h': h, 'at': at, **r}
        r_saved = results[p['id']]
        s = summary(r)
        cnt[s] = cnt.get(s, 0) + 1
        for it in r['items']:
            if it['result'] != 'na':
                kinds[(it['kind'], it['result'])] = kinds.get((it['kind'], it['result']), 0) + 1
        lints += bool(r['lint'])
    print(f'自動検証：{len(ps)}問 → 一致 {cnt.get("pass", 0)}・一部だけ確認 {cnt.get("partial", 0)}・不一致 {cnt.get("issue", 0)}・対象外 {cnt.get("na", 0)}')
    for (k, res), n in sorted(kinds.items()):
        print(f'  {k}：{RESULT_JA[res]} {n}小問')
    print(f'  構造の不整合の候補がある問題 {lints}問')
    fails = [(i, it) for i, r in results.items() for it in r.get('items', []) if it['result'] == 'fail']
    for i, it in fails[:20]:
        print(f"  不一致 {i}({it['i']}) {it['kind']}：{it['detail']}")
    if '--write' in args:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        doc = {'schema': 'lemma.quality.auto/1', 'tool': TOOL, 'date': today,
               'note': '自動検証の記録（tools/verify_math.py）。h は検証した時点の内容の照合用の値。人による確認ではない。',
               'results': dict(sorted(results.items()))}
        OUT.write_text('{\n' + ',\n'.join(f'{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}' for k, v in doc.items() if k != 'results')
                       + ',\n"results": {\n' + ',\n'.join(f'{json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in doc['results'].items()) + '\n}\n}\n', encoding='utf-8')
        print(f'  {OUT} に保存しました')
    return 0


if __name__ == '__main__':
    sys.exit(main())
