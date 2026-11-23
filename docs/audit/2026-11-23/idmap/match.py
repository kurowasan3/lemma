#!/usr/bin/env python3
"""アプリ（content/）と管理表の問題を、ID を使わずに問題内容で照合する（読み取り専用）。

python3 match.py 管理表.xlsx content_dir out_dir
"""
import csv
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import warnings
warnings.filterwarnings('ignore')
import openpyxl

XLSX, CONTENT, OUT = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------- 正規化
def n0(s):                       # 前後の空白だけ
    return (s or '').strip()


def n1(s):                       # 空白・改行の違いを無視
    return re.sub(r'\s+', '', n0(s))


def n2(s):
    """表記の揺れを無視（数学的内容は変えない置き換えだけ）"""
    s = unicodedata.normalize('NFKC', n0(s))
    s = re.sub(r'\\(mathrm|text|textrm|textup|rm|mathit|boldsymbol|bm|mathbf|textbf|displaystyle|textstyle)\b', '', s)
    s = re.sub(r'\\[dt]frac', r'\\frac', s)
    s = re.sub(r'\\(left|right|big|Big|bigg|Bigg)(?![a-zA-Z])', '', s)
    s = re.sub(r'\\(quad|qquad|,|;|!|:| )', '', s)
    s = re.sub(r'\\(leqq|leqslant)', r'\\le', s)
    s = re.sub(r'\\(geqq|geqslant)', r'\\ge', s)
    s = s.replace('\\lt', '<').replace('\\gt', '>')
    s = re.sub(r'[，、]', ',', s)
    s = re.sub(r'[．。]', '.', s)
    s = re.sub(r'[{}\s$]', '', s)          # 波括弧・数式区切り・空白
    return s


def numbers(s):
    t = re.sub(r'\\item|\\begin\{enumerate\}|\\end\{enumerate\}|\(\d+\)|\[label=[^\]]*\]', '', s or '')
    return Counter(re.findall(r'\d+(?:\.\d+)?', n2(t)))


def grams(s, k=4):
    t = n2(s)
    return {t[i:i + k] for i in range(max(1, len(t) - k + 1))}


def sim(a, b):
    a, b = n2(a), n2(b)
    if not a and not b:
        return 1.0
    return SequenceMatcher(None, a, b, autojunk=False).ratio()


# ---------------------------------------------------------------- 読み込み
tax = json.loads((CONTENT / 'taxonomy.json').read_text())
fname = {f['key']: (f['subject'], f['name']) for f in tax['fields']}
fkey = {(f['subject'], f['name']): f['key'] for f in tax['fields']}


def tex(v):
    if isinstance(v, dict):
        return v.get('tex', '')
    if isinstance(v, list):
        return '\n'.join(tex(x) for x in v)
    return v or ''


app = {}
for f in sorted((CONTENT / 'problems').glob('*.json')):
    if f.name == 'builtin.json':
        continue
    for x in json.loads(f.read_text()):
        app[x['id']] = dict(id=x['id'], field=x['field'], subject=fname.get(x['field'], ('', ''))[0],
                            theme=x.get('theme') or '', level=str(x.get('level')), created=(x.get('provenance') or {}).get('created') or '',
                            st=tex(x['statement']), ans=tex(x['answer']), sol=tex(x['solutions']), idea=tex(x.get('idea')),
                            hidden=(x.get('quality') or {}).get('status') == 'hidden')

ws = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)['問題一覧']
rows = list(ws.iter_rows(values_only=True))
head = [str(c or '').strip() for c in rows[0]]
col = {h: i for i, h in enumerate(head)}
exl = {}
for n, r in enumerate(rows[1:], start=2):
    if not r[0]:
        continue
    g = lambda h: '' if r[col[h]] is None else str(r[col[h]])
    eid = str(r[0]).strip()
    key = fkey.get((g('科目'), g('分野')), '')
    exl[eid] = dict(id=eid, row=n, field=key, subject=g('科目'), theme=g('単元・テーマ'), level=g('難易度'),
                    created=g('作成日')[:10], st=g('問題文（LaTeX）'), ans=g('答え'), sol=g('解答・解説'), idea=g('核となるアイデア'),
                    example='記入例' in g('メモ'), hidden='非表示' in g('タグ'))

# ---------------------------------------------------------------- 索引
by_st0 = defaultdict(list); by_st2 = defaultdict(list); gram_idx = defaultdict(set)
for e in exl.values():
    by_st0[n0(e['st'])].append(e['id']); by_st2[n2(e['st'])].append(e['id'])
    for g_ in grams(e['st']):
        gram_idx[g_].add(e['id'])
app_by_st2 = defaultdict(list)
for a in app.values():
    app_by_st2[n2(a['st'])].append(a['id'])


def same(a, e, k):
    """0: 完全一致 1: 空白だけ違う 2: 表記だけ違う 3: 内容が違う"""
    x, y = a[k], e[k]
    if n0(x) == n0(y): return 0
    if n1(x) == n1(y): return 1
    if n2(x) == n2(y): return 2
    return 3


LBL = {0: '一致', 1: '空白のみ差', 2: '表記のみ差', 3: '内容差'}


def fuzzy(a, limit=3):
    gs = grams(a['st']); cnt = Counter()
    for g_ in gs:
        for eid in gram_idx.get(g_, ()):
            cnt[eid] += 1
    out = []
    for eid, c in sorted(cnt.items(), key=lambda kv: (-kv[1], kv[0]))[:30]:   # 同数のときは ID 順（実行ごとに変わらないように）
        e = exl[eid]
        jac = c / max(1, len(gs | grams(e['st'])))
        if jac < 0.35: break
        out.append((sim(a['st'], e['st']), eid))
    return sorted(out, reverse=True)[:limit]


def diff_desc(a, e, stl):
    d = []
    if stl == 3:
        na, ne = numbers(a['st']), numbers(e['st'])
        if na != ne:
            d.append('問題文の数値が違う（アプリ ' + ' '.join(sorted((na - ne).elements())[:6]) + ' / 管理表 ' + ' '.join(sorted((ne - na).elements())[:6]) + '）')
        else:
            d.append('問題文の文言・条件が違う（数値は同じ）')
    for k, nm in (('ans', '答え'), ('sol', '解説'), ('idea', '核となるアイデア')):
        s = same(a, e, k)
        if s: d.append(f'{nm}：{LBL[s]}')
    if a['field'] != e['field']: d.append(f'分野：{a["field"]}／{e["field"] or e["subject"]}')
    if a['level'] != e['level']: d.append(f'難易度：{a["level"]}／{e["level"]}')
    if a['theme'] != e['theme']: d.append('テーマが違う')
    if a['created'] != e['created']: d.append(f'作成日：{a["created"]}／{e["created"]}')
    return d


# v0.27.0 でアプリ側だけ直した列の修正前の値（照合はこれで行う）
BEFORE = {}
for r in list(csv.reader(open(str(CONTENT.parent / 'docs/audit/2026-11-23/fixes.csv'), encoding='utf-8-sig')))[1:]:
    BEFORE.setdefault(r[0], {})[{'問題文（LaTeX）': 'st', '答え': 'ans', '解答・解説': 'sol'}[r[3]]] = r[4]

# ---------------------------------------------------------------- 照合
mapping, used = [], defaultdict(list)
for aid in sorted(app):
    a = app[aid]
    exact = [eid for eid in by_st2.get(n2(a['st']), [])]
    twins = app_by_st2.get(n2(a['st']), [])          # アプリの中で問題文が同じもの
    cand = []
    if exact:
        for eid in exact:
            e = exl[eid]; stl = same(a, e, 'st'); al = same(a, e, 'ans'); sl = same(a, e, 'sol')
            cand.append((eid, stl, al, sl))
    elif aid in BEFORE and 'st' in BEFORE[aid] and aid in exl and n2(BEFORE[aid]['st']) == n2(exl[aid]['st']):
        cand.append((aid, 3, same(a, exl[aid], 'ans'), same(a, exl[aid], 'sol'), sim(a['st'], exl[aid]['st'])))
    else:
        for s_, eid in fuzzy(a):
            e = exl[eid]
            cand.append((eid, 3, same(a, e, 'ans'), same(a, e, 'sol'), s_))
    # 分類
    rec = dict(app_id=aid, excel_id='', match_category='', confidence='', statement_match='', answer_match='', solution_match='',
               field_match='', level_match='', differences='', reason='', human_review_required='')
    if not cand:
        rec.update(match_category='G', confidence='—', reason='問題文が同じか近い問題が管理表に無い', human_review_required='要')
        mapping.append(rec); continue
    if exact:
        # 問題文が同じ候補が複数、またはアプリ側にも同じ問題文が複数 → 一意に決めない
        if len(exact) > 1 or len(twins) > 1:
            same_id = [c for c in cand if c[0] == aid]
            rec.update(match_category='F', excel_id='／'.join(c[0] for c in cand), confidence='低',
                       statement_match='一致', reason=f'問題文が同じ問題が 管理表に{len(exact)}件・アプリに{len(twins)}件ある（重複問題の可能性）'
                       + ('。同じIDの候補あり' if same_id else ''), human_review_required='要')
            for c in cand: used[c[0]].append(aid)
            mapping.append(rec); continue
        eid, stl, al, sl = cand[0]
        e = exl[eid]
        rec.update(excel_id=eid, statement_match=LBL[stl], answer_match=LBL[al], solution_match=LBL[sl],
                   field_match='一致' if a['field'] == e['field'] else '違う', level_match='一致' if a['level'] == e['level'] else '違う',
                   differences='／'.join(diff_desc(a, e, stl)))
        used[eid].append(aid)
        if eid != aid:
            if al <= 2:
                rec.update(match_category='D', confidence='高' if sl <= 2 else '中',
                           reason='問題文と答えが同じで、IDだけが違う' + ('' if sl <= 2 else '（解説は違う）'),
                           human_review_required='要' if sl == 3 else '不要')
            else:
                rec.update(match_category='H', confidence='中', reason='問題文は同じだがIDも答えも違う', human_review_required='要')
        elif stl == 0 and al == 0 and sl == 0:
            rec.update(match_category='A', confidence='高', reason='同じIDで問題文・答え・解説が一致', human_review_required='不要')
        elif al <= 2 and sl <= 2:
            rec.update(match_category='C', confidence='高', reason='同じIDで、空白・LaTeXの表記だけが違う', human_review_required='不要')
        else:
            rec.update(match_category='B', confidence='高', reason='同じIDで問題文は同じ、答えか解説の内容が違う（どちらかで修正された）',
                       human_review_required='要')
        mapping.append(rec); continue
    # 問題文は一致しない：近い候補だけ
    top = cand[0]; eid = top[0]; e = exl[eid]; s_ = top[4]
    close = [c for c in cand if c[4] >= 0.85]
    if len(close) > 1:
        rec.update(match_category='F', excel_id='／'.join(c[0] for c in close), confidence='低',
                   statement_match=f'類似 {close[0][4]:.2f}', reason='問題文の近い候補が複数', human_review_required='要')
        mapping.append(rec); continue
    if s_ >= 0.6:
        rec.update(match_category='E', excel_id=eid, confidence='低', statement_match=f'類似 {s_:.2f}', answer_match=LBL[top[2]],
                   solution_match=LBL[top[3]], field_match='一致' if a['field'] == e['field'] else '違う',
                   level_match='一致' if a['level'] == e['level'] else '違う', differences='／'.join(diff_desc(a, e, 3)),
                   reason='問題文の一部が違う（改題・修正・派生問題の可能性）' + ('。IDも違う' if eid != aid else ''), human_review_required='要')
        used[eid].append(aid)
    else:
        rec.update(match_category='G', confidence='—', reason=f'近い候補はあるが似ていない（最大類似 {s_:.2f}：{eid}）', human_review_required='要')
    mapping.append(rec)

# ---------------------------------------------------------------- 理由の補足
FIX = {}
for r in list(csv.reader(open(str(CONTENT.parent / 'docs/audit/2026-11-23/fixes.csv'), encoding='utf-8-sig')))[1:]:
    FIX.setdefault(r[0], []).append(r[3])
exact_owner = {m['excel_id']: m['app_id'] for m in mapping if m['match_category'] in 'ABCD' and m['excel_id']}
for m in mapping:
    if m['app_id'] in FIX and m['match_category'] in 'BE':
        m['reason'] = f'v0.27.0 でアプリ側だけ修正（{"・".join(FIX[m["app_id"]])}。fixes.csv）。管理表の値は fixes.csv の修正前と一致'
        m['human_review_required'] = '不要'
        m['confidence'] = '高'
    elif m['match_category'] == 'E' and m['excel_id'] in exact_owner and exact_owner[m['excel_id']] != m['app_id']:
        m['reason'] = (f'近い管理表の問題 {m["excel_id"]} は、アプリの {exact_owner[m["excel_id"]]} と問題文が一致済み。'
                       'アプリにある類題で、管理表からは消えている可能性')
    elif m['match_category'] == 'E' and m['excel_id'] == m['app_id']:
        m['reason'] = '同じIDで問題文の言い回しが違う（アプリは初回コミットからこの文。どちらで変わったかは履歴から確定できない）'

# ---------------------------------------------------------------- 衝突・対応なし
conf = []
m_by_app = {m['app_id']: m for m in mapping}
for eid, aids in used.items():
    if len(set(aids)) > 1:
        conf.append(['多対一', eid, '・'.join(sorted(set(aids))), f'管理表の {eid} に、アプリの {len(set(aids))}問が対応する'])
for m in mapping:
    if m['match_category'] == 'F':
        conf.append(['複数候補', m['excel_id'], m['app_id'], m['reason']])
# 同じIDで別の問題
for aid in sorted(set(app) & set(exl)):
    m = m_by_app[aid]
    if m['excel_id'] != aid:
        e = exl[aid]
        back = [x['app_id'] for x in mapping if x['excel_id'] == aid]
        conf.append(['同一ID別問題', aid, aid,
                     f'アプリの {aid} は管理表では {m["excel_id"] or "見つからない"}（{m["match_category"]}）。管理表の {aid} はアプリでは '
                     f'{"・".join(back) if back else "見つからない"}（問題文の類似 {sim(app[aid]["st"], e["st"]):.2f}）'])

matched_ex = set(used)
unm_ex = []
for eid in sorted(exl):
    if eid in matched_ex: continue
    e = exl[eid]
    # アプリ側の近い候補
    best = max(((sim(e['st'], app[a]['st']), a) for a in app_by_st2.get(n2(e['st']), [])), default=None)
    unm_ex.append(dict(excel_id=eid, row=e['row'], subject=e['subject'], field=e['field'], level=e['level'], created=e['created'],
                       note='記入例の行' if e['example'] else ('非表示タグ' if e['hidden'] else ''),
                       app_same_id='あり（別の問題）' if eid in app else 'なし'))

# ---------------------------------------------------------------- 書き出し
def W(name, head, rows):
    with open(OUT / name, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(head); w.writerows(rows)


H = ['app_id', 'excel_id', 'match_category', 'confidence', 'statement_match', 'answer_match', 'solution_match', 'field_match',
     'level_match', 'differences', 'reason', 'human_review_required']
W('id_mapping.csv', H, [[m[h] for h in H] for m in mapping])
W('id_conflicts.csv', ['種類', '管理表のID', 'アプリのID', '内容'], conf)
W('unmatched_app.csv', ['app_id', 'field', 'level', 'created', 'hidden', 'reason'],
  [[m['app_id'], app[m['app_id']]['field'], app[m['app_id']]['level'], app[m['app_id']]['created'], '非表示' if app[m['app_id']]['hidden'] else '', m['reason']]
   for m in mapping if m['match_category'] == 'G'])
W('unmatched_excel.csv', ['excel_id', 'row', 'subject', 'field', 'level', 'created', 'note', 'app_same_id'],
  [[u[k] for k in ('excel_id', 'row', 'subject', 'field', 'level', 'created', 'note', 'app_same_id')] for u in unm_ex])

cat = Counter(m['match_category'] for m in mapping)
summary = dict(app=len(app), excel=len(exl), categories=dict(sorted(cat.items())),
               human=sum(m['human_review_required'] == '要' for m in mapping),
               conflicts=dict(Counter(c[0] for c in conf)), unmatched_excel=len(unm_ex),
               unmatched_excel_notes=dict(Counter(u['note'] for u in unm_ex)))
json.dump(summary, open(OUT / 'summary.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False, indent=1))
