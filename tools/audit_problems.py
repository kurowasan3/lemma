#!/usr/bin/env python3
"""問題の品質確認を助ける一覧を作る（問題は消さない・書きかえない。管理表も書きかえない）。

  python3 tools/audit_problems.py                 # 要約だけ
  python3 tools/audit_problems.py --csv DIR       # DIR に similar.csv・role.csv・quality.csv・priority.csv を書き出す（Excel で開ける UTF-8）
  python3 tools/audit_problems.py --reviewed FILE [--csv DIR]
                                                  # 人が記入した quality.csv を検証し、管理表の「検証:人間確認」と照合する
                                                  # （入力の誤り・存在しない問題 ID があれば終了コード 1）
  python3 tools/audit_problems.py --reviewed FILE --record
                                                  # 誤りが無ければ、完了・要修正を content/quality/human.json に記録する

品質の状態は、自動検証（content/quality/auto.json。tools/verify_math.py）と人の確認（content/quality/human.json・管理表の
「検証:人間確認」）を分けて扱う。自動検証の合格を人の確認として扱わない。詳しくは docs/quality.md。
学習上の役割が近い候補（role.csv）：主な解法・難易度・要求が同じで、核となるアイデアかテーマが近い組。
同じ解法でもアイデア・テーマが違う組は出さない。

1) 類似・重複の候補（similar.csv）……候補であり、数学的に同じだとは断定しない
   - 同一：問題文が空白・句読点の違いを除いて同じ
   - 数値違い：数字をすべて同じ記号に置きかえると同じ（数値だけ変えた類題。反復用に必要なことが多く、消す対象ではない）
   - 類似：数字を置きかえた問題文の文字4-gram の Jaccard 係数が 0.7 以上（MinHash で候補を出し、実際の値で確かめる）
     数字を置きかえない問題文での値（数値まで含めた類似度）も並べる。
     短い問題文（数字を置きかえて60文字未満）は「〜を求めよ」などの定型の言い回しだけで似やすいので、短いと印を付け、
     優先1には入れない（実データで、短い問題文の 0.7〜0.8 の組は別の型の漸化式などだった）。
   文字列の比較なので、表現が違うだけの同じ問題は見つからない。
2) 品質の一覧（quality.csv）
   自動で確かめられる項目、人が判断する項目（【人】の空欄）、管理表の「検証:人間確認」の今の値、
   内容の照合用の値（問題文・答え・解説・核となるアイデアから作る。内容が変わると変わる）。
3) 優先して確認する問題（priority.csv）……確認の順序であって品質の点数ではない。1問1行、挙がった理由をすべて書く
     優先1：同一の問題文・数値だけ違う問題文・類似度 0.9 以上（短い問題文を除く）……重複していないかを見る
     優先2：解答・解説・核となるアイデアのどれかが無い
     優先3：主な解法が決まっていない（入試基礎以上）・自動検算が未実施
     優先4：同じ主な解法・同じ難易度に類似候補が集まっている
   同じ優先度の中は、頻出度の高い順（data/index.json の値。自動判定を含む）・難易度の低い順。
   人の確認が済んだ問題（管理表の「検証:人間確認」が「済」）は優先2〜4から外す。
4) 照合（--reviewed）
   【人】の各項目に書けるのは OK（問題なし）・要修正（修正が必要）・×（問題あり）・空欄（未確認）だけ。
   それ以外の値は不正な入力として警告し、その問題は確認済みにしない。
   9項目すべてが OK → 管理表の「検証:人間確認」を「済」にしてよい問題
   要修正・× が1つでもある → 直す問題
   一部が空欄 → 確認途中
   問題 ID がデータに無い → 誤り。同じ問題 ID が複数行 → 警告し、その問題は確認済みにしない。
   内容の照合用の値が今のデータと違う（記入後に問題が直された・古い CSV）→ 警告し、確認済みにしない。

基礎・標準の問題が少ないことは欠点として扱わない（厳選した問題をくり返す方針のため）。
"""
import json, re, sys, csv, random, hashlib, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_math as VM  # noqa: E402  内容の照合用の値・自動検証の状態を共有する
HUMAN = ['数学的正確性', '問題文の明確さ', '解答の正確性', '解説の十分性', '難易度の妥当性', '教育的価値', '他の問題との差別化', '分類・タグの妥当性', '収録する価値']
HCOLS = [f'【人】{h}' for h in HUMAN]
ALLOWED = {'OK': 'ok', '要修正': 'fix', '×': 'fix', '': 'blank'}
SHORT = 60
HASH_COL = '内容の照合用（変えない）'


def load(root=ROOT):
    ps = []
    for f in sorted((root / 'content' / 'problems').glob('*.json')):
        if f.name == 'builtin.json':
            continue
        ps += json.loads(f.read_text(encoding='utf-8'))
    return [p for p in ps if p['quality']['status'] == 'published']


content_hash = VM.content_hash
HUMAN_OUT = ROOT / 'content' / 'quality' / 'human.json'


# ---------------------------------------------------------------- 品質の状態（自動と人を分ける）
AUTO_JA = {'none': '未実行', 'stale': '記録が古い（内容が変わった）', 'pass': '合格（答えの値）', 'partial': '一部の小問だけ確認',
           'issue': '不一致あり', 'na': '対象外'}
HUMAN_JA = {'none': '未実施', 'done': '完了', 'fix': '要修正', 'stale': '記録が古い（内容が変わった）', 'declared': '管理表で済（内容の照合なし）'}


def load_quality(root=ROOT):
    auto_p, human_p = root / 'content' / 'quality' / 'auto.json', root / 'content' / 'quality' / 'human.json'
    auto = json.loads(auto_p.read_text(encoding='utf-8'))['results'] if auto_p.exists() else {}
    human = json.loads(human_p.read_text(encoding='utf-8'))['results'] if human_p.exists() else {}
    return auto, human


def quality_status(p, auto, human):
    """(自動検証の状態, 人の確認の状態)。自動検証の合格は人の確認として扱わない"""
    h = content_hash(p)
    a = auto.get(p['id'])
    a_st = 'none' if not a else 'stale' if a['h'] != h else VM.summary(a)
    hr = human.get(p['id'])
    if hr:
        h_st = 'stale' if hr['h'] != h else hr['result']
    elif p['quality'].get('checks', {}).get('human'):
        h_st = 'declared'
    else:
        h_st = 'none'
    return a_st, h_st


# ---------------------------------------------------------------- 学習上の役割の近い問題（教材の重複の候補）
def request_type(st):
    s = re.sub(r'\$[^$]*\$', ' ', st)
    for k, pat in [('証明', r'示せ|証明'), ('個数', r'何通り|個数|いくつ|何個'), ('確率', r'確率'), ('最大・最小', r'最大|最小'),
                   ('範囲', r'範囲|とりうる'), ('図示', r'図示')]:
        if re.search(pat, s):
            return k
    return '値'


ROLE = {0: '基礎の反復', 1: '基礎の反復', 2: '標準解法の習得', 3: '標準解法の習得', 4: '解法の応用', 5: '挑戦'}


def grams3(t):
    s = re.sub(r'\d+', '#', re.sub(r'\s+', '', t or ''))
    return {s[i:i + 3] for i in range(max(1, len(s) - 2))} if s else set()


def role_pairs(ps, main_of, techs_of, idea_thr=0.5, theme_thr=0.6):
    """同じ主な解法・同じ難易度・同じ要求の問題のうち、核となるアイデアかテーマが近い組。
    同じ解法でも、アイデア・テーマが違う（違う条件・着眼点・応用先を学べる）組は出さない。"""
    G = collections.defaultdict(list)
    for p in ps:
        m = main_of.get(p['id'])
        if m:
            G[(m, p['level'], request_type(p['statement']['tex']))].append(p)
    out = []
    for (m, lv, rq), g in G.items():
        ig = {p['id']: grams3(p.get('idea', {}).get('tex', '')) for p in g}
        tg = {p['id']: grams3(p.get('theme', '')) for p in g}
        for i in range(len(g)):
            for j in range(i + 1, len(g)):
                a, b = g[i]['id'], g[j]['id']
                ji = jaccard(ig[a], ig[b]) if ig[a] and ig[b] else 0
                jt = jaccard(tg[a], tg[b]) if tg[a] and tg[b] else 0
                if ji >= idea_thr or jt >= theme_thr:
                    out.append({'a': a, 'b': b, 'main': m, 'level': lv, 'request': rq, 'role': ROLE[lv], 'idea': ji, 'theme': jt,
                                'sub_a': sorted(techs_of.get(a, set()) - {m}), 'sub_b': sorted(techs_of.get(b, set()) - {m})})
    return sorted(out, key=lambda x: (-max(x['idea'], x['theme']), x['a'], x['b']))


def norm(tex, mask_digits):
    s = re.sub(r'\\(?:,|;|!|quad|qquad| )', '', tex)
    s = re.sub(r'[\s，,．.、。　]+', '', s)
    if mask_digits:
        s = re.sub(r'\d+(?:\.\d+)?', '#', s)
    return s


def shingles(s, k=4):
    return {s[i:i + k] for i in range(max(1, len(s) - k + 1))}


def jaccard(a, b):
    return len(a & b) / max(1, len(a | b))


def similar_pairs(ps, thr=0.7, perms=64, bands=16):
    """(a, b, 数字を置きかえた類似度, 数字を含めた類似度, 短いか) の一覧"""
    random.seed(7)
    P = (1 << 61) - 1
    A = [(random.randrange(1, P), random.randrange(0, P)) for _ in range(perms)]
    sh, raw, ln = {}, {}, {}
    for p in ps:
        m = norm(p['statement']['tex'], True)
        S = shingles(m)
        hs = [int.from_bytes(hashlib.blake2b(x.encode(), digest_size=8).digest(), 'little') for x in S]
        sh[p['id']] = (S, [min((a * h + b) % P for h in hs) for a, b in A])
        raw[p['id']] = shingles(norm(p['statement']['tex'], False))
        ln[p['id']] = len(m)
    r = perms // bands
    buckets = collections.defaultdict(list)
    for pid, (_, sig) in sh.items():
        for bi in range(bands):
            buckets[(bi, tuple(sig[bi * r:(bi + 1) * r]))].append(pid)
    cand = set()
    for ids in buckets.values():
        if 1 < len(ids) < 50:
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    cand.add(tuple(sorted((ids[i], ids[j]))))
    out = []
    for a, b in cand:
        jm = jaccard(sh[a][0], sh[b][0])
        if jm >= thr:
            out.append((a, b, jm, jaccard(raw[a], raw[b]), min(ln[a], ln[b]) < SHORT))
    return sorted(out, key=lambda x: (-x[2], x[0], x[1]))


def _norm_answer(a):
    """答えの比較用：LaTeX の書き方の違い（\\dfrac と \\frac・空白・太字・区切り・小問番号）を除く"""
    a = re.sub(r'\\[dt]frac', r'\\frac', a or '')
    a = re.sub(r'\\(?:mathrm|text|rm)\s*', '', a)
    a = re.sub(r'\\(?:,|;|quad|qquad|boldsymbol|left|right|displaystyle)|\s|　|[{}$，,．.、；;]', '', a)
    return re.sub(r'\([a-z]\)|\(\d\)|\[[A-Z]+\]', '', a)


def same_answer_pairs(ps, min_len=10, thr=0.6):
    """答え（書き方の違いを除く）が同じで、問題文に出てくる数字の重なりが thr 以上の組（v0.27）。
    文章を言いかえた同じ問題（4-gram の類似度では見つからない）を拾う。答えが「証明」だけ・短い答えは除く（偶然一致しやすい）。
    (a, b, 数字の重なり) の一覧。候補であり、重複と決めるのは人"""
    g = collections.defaultdict(list)
    for p in ps:
        a = _norm_answer(p.get('answer', {}).get('tex', ''))
        if len(a) >= min_len and not re.fullmatch(r'(証明|図示|略)*', re.sub(r'[（(][^）)]*[）)]', '', a)) and '証明' not in a:
            g[a].append(p)
    nums = lambda t: collections.Counter(re.findall(r'\d+(?:\.\d+)?', t))
    out = []
    for lst in g.values():
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                x, y = nums(lst[i]['statement']['tex']), nums(lst[j]['statement']['tex'])
                ov = sum((x & y).values()) / (sum((x | y).values()) or 1)
                if ov >= thr:
                    a, b = sorted((lst[i]['id'], lst[j]['id']))
                    out.append((a, b, ov))
    return sorted(out, key=lambda x: (-x[2], x[0], x[1]))


def groups(ps):
    byid = {p['id']: p for p in ps}
    gs, gn = collections.defaultdict(list), collections.defaultdict(list)
    for p in ps:
        gs[norm(p['statement']['tex'], False)].append(p['id'])
        gn[norm(p['statement']['tex'], True)].append(p['id'])
    same = [g for g in gs.values() if len(g) > 1]
    num = [g for g in gn.values() if len(g) > 1 and len({norm(byid[i]['statement']['tex'], False) for i in g}) > 1]
    return same, num


def techs_map(root=ROOT):
    """問題 ID → 結びつく解法 ID の集合（主・補助とも）"""
    out = collections.defaultdict(set)
    dt = root / 'data' / 'techniques.json'
    if dt.exists():
        for t in json.loads(dt.read_text(encoding='utf-8'))['techniques']:
            for i in t['ids']:
                out[i].add(t['id'])
    return out


def index_values(root=ROOT):
    """data/index.json の頻出度（自動判定を含む。無ければ 2）と主な解法"""
    v, main_of = {}, {}
    ip = root / 'data' / 'index.json'
    if ip.exists():
        for e in json.loads(ip.read_text(encoding='utf-8'))['problems']:
            v[e['id']] = e.get('v', 2)
    dt = root / 'data' / 'techniques.json'
    if dt.exists():
        for t in json.loads(dt.read_text(encoding='utf-8'))['techniques']:
            for i in t['main']:
                main_of.setdefault(i, t['id'])
    return v, main_of


def priority(ps, same, num, sim, value, main_of, quality=None, roles=None, same_ans=None):
    """{問題ID: (優先度, [理由])}。1問1つ。優先度は最も高いもの、理由はすべて。
    quality: {問題ID: (自動検証の状態, 人の確認の状態, 構造の候補[])}（省略可）。roles: role_pairs の結果（省略可）"""
    quality = quality or {}
    byid = {p['id']: p for p in ps}
    reasons, tier = collections.defaultdict(list), {}

    def put(pid, t, why):
        if why not in reasons[pid]:
            reasons[pid].append(why)
        tier[pid] = min(tier.get(pid, 9), t)
    for g in same:
        for i in g: put(i, 1, '同一の問題文：' + ' '.join(x for x in g if x != i))
    for g in num:
        for i in g: put(i, 1, '数値だけ違う問題文：' + ' '.join(x for x in g if x != i) + '（類題として残すかを判断。消す対象とは限らない）')
    for a, b, ov in same_ans or []:
        put(a, 1, f'答えが同じで問題文の数字も近い（数字の重なり {ov:.2f}）：{b}（同じ問題が2つある候補）')
        put(b, 1, f'答えが同じで問題文の数字も近い（数字の重なり {ov:.2f}）：{a}（同じ問題が2つある候補）')
    for a, b, jm, jr, short in sim:
        if jm >= 0.9 and not short:
            put(a, 1, f'類似 {jm:.2f}（数値も含め {jr:.2f}）：{b}'); put(b, 1, f'類似 {jm:.2f}（数値も含め {jr:.2f}）：{a}')
    sim_n = collections.Counter()
    for a, b, *_ in sim:
        sim_n[a] += 1; sim_n[b] += 1
    clus = {(main_of.get(a), byid[a]['level']) for a, b, *_ in sim if main_of.get(a) and main_of.get(a) == main_of.get(b) and byid[a]['level'] == byid[b]['level']}
    for pid, (a_st, h_st, lints) in quality.items():
        if pid not in byid:
            continue
        if a_st == 'issue': put(pid, 1, '自動検証で答えと不一致')
        if h_st == 'fix': put(pid, 1, '人の確認で要修正')
    for p in ps:
        a_st, h_st, lints = quality.get(p['id'], (None, 'declared' if p['quality'].get('checks', {}).get('human') else 'none', []))
        if h_st in ('done', 'declared'):
            continue
        for l in lints: put(p['id'], 2, '構造の候補：' + l)
        if a_st == 'stale': put(p['id'], 3, '自動検証の記録が古い（内容が変わった）')
        if h_st == 'stale': put(p['id'], 3, '人の確認の記録が古い（内容が変わった）')
        if not p.get('answer', {}).get('tex', '').strip(): put(p['id'], 2, '解答が無い')
        if not sum(len(x.get('tex', '')) for x in p.get('solutions', [])): put(p['id'], 2, '解説が無い')
        if not p.get('idea', {}).get('tex', '').strip(): put(p['id'], 2, '核となるアイデアが無い')
        if p['level'] >= 2 and not main_of.get(p['id']): put(p['id'], 3, '主な解法が決まっていない')
        if not p['quality'].get('checks', {}).get('sympy', False): put(p['id'], 3, '自動検算が未実施')
        if (main_of.get(p['id']), p['level']) in clus and sim_n.get(p['id']): put(p['id'], 4, '同じ主な解法・同じ難易度に類似候補が集まっている')
    done = {p['id'] for p in ps if quality.get(p['id'], (None, 'declared' if p['quality'].get('checks', {}).get('human') else 'none'))[1] in ('done', 'declared')}
    for x in roles or []:
        for a, b in ((x['a'], x['b']), (x['b'], x['a'])):
            if a not in done:
                put(a, 4, f"学習上の役割が近い候補：{b}（主な解法・難易度・要求が同じで、アイデア {x['idea']:.2f}・テーマ {x['theme']:.2f}）")
    return {i: (tier[i], reasons[i]) for i in tier}


def priority_order(pri, byid, value):
    return sorted(pri, key=lambda i: (pri[i][0], -value.get(i, 2), byid[i]['level'], i))


REQUIRED = ['問題ID', HASH_COL] + HCOLS


def read_reviewed(path):
    """人が記入した quality.csv を読む（BOM つき UTF-8 可・列の順番は問わない）。
    返り値 (rows, errors)。必要な列が無ければ行は読まずに誤りを返す。列の数が見出しと合わない行は誤り、すべて空の行は空行として飛ばす。"""
    with open(path, encoding='utf-8-sig', newline='') as f:
        rd = list(csv.reader(f))
    if not rd:
        return [], ['CSV が空です']
    head = [h.strip() for h in rd[0]]
    missing = [c for c in REQUIRED if c not in head]
    if missing:
        return [], ['必要な列が無い：' + '、'.join(missing) + '（quality.csv を書き出し直してください）']
    dup = sorted({h for h in head if h and head.count(h) > 1})
    if dup:
        return [], ['同じ名前の列が複数ある：' + '、'.join(dup)]
    rows, errors = [], []
    for n, cells in enumerate(rd[1:], start=2):
        if not any(c.strip() for c in cells):
            continue                                   # 空行
        if len(cells) != len(head):
            errors.append(f'{n}行目：列の数（{len(cells)}）が見出し（{len(head)}）と合わない（区切りの崩れた行）')
            continue
        row = dict(zip(head, cells))
        row['_line'] = n
        rows.append(row)
    return rows, errors


def check_reviewed(rows, byid):
    """人が記入した quality.csv の行を検証する。管理表・データは変えない。
    返り値：done（済にしてよい）・fix（直す: [(id, [項目])]）・partial（確認途中）・errors・warnings"""
    res = {'done': [], 'fix': [], 'partial': [], 'errors': [], 'warnings': [], 'items': {}}
    # 必要な列の欠けは、記入の有無より先に調べる（列が欠けた CSV の行を「空欄」と取り違えない）
    if rows:
        missing = [c for c in REQUIRED if c not in rows[0]]
        if missing:
            res['errors'].append('必要な列が無い：' + '、'.join(missing) + '（quality.csv を書き出し直してください）')
            return res
    seen = collections.Counter(str(r.get('問題ID', '')).strip() for r in rows)
    for k, row in enumerate(rows, start=2):   # 1行目は見出し
        n = row.get('_line', k)
        pid = str(row.get('問題ID', '') or '').strip()
        vals = [str(row.get(c, '') or '').strip() for c in HCOLS]
        if not pid:
            if any(vals): res['errors'].append(f'{n}行目：問題 ID が空なのに記入がある')
            continue
        if pid not in byid:
            res['errors'].append(f'{n}行目：問題 ID {pid} が今のデータに無い')
            continue
        if not any(vals):
            continue
        if seen[pid] > 1:
            res['warnings'].append(f'{n}行目：問題 ID {pid} が {seen[pid]} 行ある（確認済みにしない）')
            res['partial'].append(pid)
            continue
        bad = [(h, v) for h, v in zip(HUMAN, vals) if v not in ALLOWED]
        if bad:
            res['warnings'].append(f'{n}行目 {pid}：使えない値 ' + '、'.join(f'{h}「{v}」' for h, v in bad) + '（OK・要修正・×・空欄だけ。確認済みにしない）')
        h = str(row.get(HASH_COL, '') or '').strip()
        cur = content_hash(byid[pid])
        if h != cur:
            res['warnings'].append(f'{n}行目 {pid}：内容の照合用の値が今のデータと違う（{h or "空"} → {cur}。記入後に問題が直されたか、古い CSV。確認済みにしない）')
            res['partial'].append(pid)
            continue
        kinds = [ALLOWED.get(v) for v in vals]
        res['items'][pid] = dict(zip(HUMAN, vals))
        fixes = [hh for hh, k in zip(HUMAN, kinds) if k == 'fix']
        if fixes:
            res['fix'].append((pid, fixes))
        elif bad or 'blank' in kinds:
            res['partial'].append(pid)
        elif all(k == 'ok' for k in kinds):
            if not byid[pid]['quality'].get('checks', {}).get('human', False):
                res['done'].append(pid)
    return res


def record_human(res, byid, path=HUMAN_OUT, today=None, method='quality.csv の記入（tools/audit_problems.py --reviewed --record）'):
    """人の確認の結果を content/quality/human.json に記録する（管理表・問題データは書きかえない）。
    記録するのは「完了」（9項目すべて OK）と「要修正」だけ。照合用の値（内容）と日付・方法を残す。"""
    import datetime
    today = today or datetime.date.today().isoformat()
    doc = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {
        'schema': 'lemma.quality.human/1', 'note': '人による数学的確認の記録。h は確認した時点の内容の照合用の値。自動検証の結果ではない。', 'results': {}}
    for pid in res['done']:
        doc['results'][pid] = {'h': content_hash(byid[pid]), 'at': today, 'result': 'done', 'method': method, 'items': res['items'].get(pid, {})}
    for pid, bad in res['fix']:
        doc['results'][pid] = {'h': content_hash(byid[pid]), 'at': today, 'result': 'fix', 'method': method, 'items': res['items'].get(pid, {})}
    doc['results'] = dict(sorted(doc['results'].items()))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return len(res['done']) + len(res['fix'])


def main():
    args = sys.argv[1:]
    ps = load()
    byid = {p['id']: p for p in ps}
    if '--reviewed' in args:
        src = Path(args[args.index('--reviewed') + 1])
        rows, read_errors = read_reviewed(src)
        res = check_reviewed(rows, byid) if not read_errors or rows else {'done': [], 'fix': [], 'partial': [], 'errors': [], 'warnings': [], 'items': {}}
        res['errors'] = read_errors + res['errors']
        print(f"照合：管理表の「検証:人間確認」を「済」にしてよい問題 {len(res['done'])}問・直す問題 {len(res['fix'])}問・確認途中 {len(res['partial'])}問")
        for e in res['errors']: print('  誤り：' + e)
        for w in res['warnings']: print('  警告：' + w)
        if '--record' in args:
            if res['errors']:
                print('  誤りがあるので記録しませんでした（直してからもう一度）')
            else:
                print(f'  {record_human(res, byid)}問の結果を {HUMAN_OUT} に記録しました（管理表は書きかえていません）')
        if '--csv' in args:
            out = Path(args[args.index('--csv') + 1]); out.mkdir(parents=True, exist_ok=True)
            with open(out / 'reviewed.csv', 'w', newline='', encoding='utf-8-sig') as f:
                w = csv.writer(f); w.writerow(['問題ID', '管理表で行うこと', '項目'])
                for pid in res['done']: w.writerow([pid, '「検証:人間確認」を「済」にする', ''])
                for pid, bad in res['fix']: w.writerow([pid, '直す', '、'.join(bad)])
                for pid in dict.fromkeys(res['partial']): w.writerow([pid, '確認途中（記入が足りない・使えない値・内容が変わった・重複）', ''])
        return 1 if res['errors'] else 0
    same, num = groups(ps)
    sim = similar_pairs(ps)
    in_group = {i for g in same + num for i in g}
    sim = [x for x in sim if not (x[0] in in_group and x[1] in in_group)]
    value, main_of = index_values()
    techs_of = techs_map()
    auto, human = load_quality()
    quality = {}
    for p in ps:
        a_st, h_st = quality_status(p, auto, human)
        rec = auto.get(p['id'])
        quality[p['id']] = (a_st, h_st, rec.get('lint', []) if rec and a_st != 'stale' else [])
    roles = role_pairs(ps, main_of, techs_of)
    same_ans = same_answer_pairs(ps)
    print(f'問題 {len(ps)}問（公開）')
    print(f'  同一の問題文：{len(same)}組（{sum(len(g) for g in same)}問）')
    print(f'  数値だけ違う問題文：{len(num)}組（{sum(len(g) for g in num)}問）')
    band = collections.Counter(min(9, int(x[2] * 10)) for x in sim)
    print(f'  答えが同じで問題文の数字も近い（言いかえた同じ問題の候補）：{len(same_ans)}組')
    print(f'  類似（4-gram の Jaccard ≥ 0.7）：{len(sim)}組（0.7台 {band[7]}・0.8台 {band[8]}・0.9以上 {band[9]}。うち短い問題文 {sum(1 for x in sim if x[4])}組）')
    print(f'  学習上の役割が近い候補（主な解法・難易度・要求が同じで、アイデアかテーマが近い）：{len(roles)}組')
    ac = collections.Counter(q[0] for q in quality.values()); hc = collections.Counter(q[1] for q in quality.values())
    print('  自動検証：' + '・'.join(f'{AUTO_JA[k]} {ac[k]}' for k in AUTO_JA if ac[k]) + '／人の確認：' + '・'.join(f'{HUMAN_JA[k]} {hc[k]}' for k in HUMAN_JA if hc[k]))
    print(f"  構造の候補がある問題：{sum(1 for q in quality.values() if q[2])}問")
    pri = priority(ps, same, num, sim, value, main_of, quality, roles, same_ans)
    tc = collections.Counter(t for t, _ in pri.values())
    print('  優先して確認する問題：' + '、'.join(f'優先{t} {tc[t]}問' for t in sorted(tc)))
    if '--csv' in args:
        out = Path(args[args.index('--csv') + 1]); out.mkdir(parents=True, exist_ok=True)
        with open(out / 'similar.csv', 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f); w.writerow(['種類', '問題ID（組）', '類似度（数字を置きかえ）', '類似度（数字も含む）', '短い問題文', 'テーマ'])
            for g in same: w.writerow(['同一', ' '.join(g), 1, 1, '', byid[g[0]].get('theme', '')])
            for g in num: w.writerow(['数値違い', ' '.join(g), 1, '', '', byid[g[0]].get('theme', '')])
            for a, b, ov in same_ans: w.writerow(['答えが同じ', f'{a} {b}', '', f'{ov:.2f}', '', f"{byid[a].get('theme', '')} ／ {byid[b].get('theme', '')}"])
            for a, b, jm, jr, short in sim: w.writerow(['類似', f'{a} {b}', f'{jm:.2f}', f'{jr:.2f}', '短い' if short else '', f"{byid[a].get('theme', '')} ／ {byid[b].get('theme', '')}"])
        with open(out / 'role.csv', 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            w.writerow(['問題ID A', '問題ID B', '主な解法', '補助の解法 A', '補助の解法 B', '難易度', '要求', '学習上の役割', 'アイデアの近さ', 'テーマの近さ', 'テーマ A', 'テーマ B', '核となるアイデア A', '核となるアイデア B'])
            for x in roles:
                A_, B_ = byid[x['a']], byid[x['b']]
                w.writerow([x['a'], x['b'], x['main'], '、'.join(x['sub_a']), '、'.join(x['sub_b']), x['level'], x['request'], x['role'], f"{x['idea']:.2f}", f"{x['theme']:.2f}",
                            A_.get('theme', ''), B_.get('theme', ''), A_.get('idea', {}).get('tex', ''), B_.get('idea', {}).get('tex', '')])
        sim_n = collections.Counter()
        for a, b, *_ in sim: sim_n[a] += 1; sim_n[b] += 1
        for g in same + num:
            for i in g: sim_n[i] += 1
        with open(out / 'quality.csv', 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            # 列の順と名前は v0.21 と同じ（照合はこの名前で読む）。v0.22 で右端に自動検証・構造・人の確認の記録を足した
            w.writerow(['問題ID', '分野', '難易度', 'テーマ', '解答あり', '解説あり', '解説の長さ（文字）', '核となるアイデアあり', '入力採点の答えあり', 'タグの数', '主な解法', '類似・重複の候補', '自動検算（sympy）', '管理表：検証:人間確認', HASH_COL] + HCOLS
                       + ['自動検証（リポジトリ）', '構造の候補', '人の確認（記録）'])
            for p in ps:
                sol = sum(len(x.get('tex', '')) for x in p.get('solutions', []))
                ch = p['quality'].get('checks', {})
                a_st, h_st, lints = quality[p['id']]
                w.writerow([p['id'], p['field'], p['level'], p.get('theme', ''), bool(p.get('answer', {}).get('tex', '').strip()), sol > 0, sol,
                            bool(p.get('idea', {}).get('tex', '').strip()), bool(p.get('grading', {}).get('spec', '').strip()), len(p.get('tags', [])),
                            main_of.get(p['id'], ''), sim_n.get(p['id'], 0), ch.get('sympy', False), '済' if ch.get('human') else '', content_hash(p)] + [''] * len(HUMAN)
                           + [AUTO_JA[a_st], '／'.join(lints), HUMAN_JA[h_st]])
        with open(out / 'priority.csv', 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f); w.writerow(['優先度', '問題ID', '分野', '難易度', '頻出度', 'テーマ', '挙がった理由'])
            for i in priority_order(pri, byid, value):
                w.writerow([pri[i][0], i, byid[i]['field'], byid[i]['level'], {1: '低', 2: '中', 3: '高'}[value.get(i, 2)], byid[i].get('theme', ''), '／'.join(pri[i][1])])
        print(f'  CSV を {out} に書き出しました')
    return 0


if __name__ == '__main__':
    sys.exit(main())
