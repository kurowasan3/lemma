#!/usr/bin/env python3
"""解法カードの主な解法の結びつき（人が問題ごとに確かめたもの）が崩れていないかを確かめる。

1. 管理表の「解法」列の読み方（tools/build_app_data.py の select_techniques）：
   空欄はタグから自動、「主な解法なし」は主を空にしてタグの解法を補助にだけ、名前の並びは先頭が主。
   「主な解法なし」をほかの解法と並べたら誤り、無い名前は誤り。予約語をカードの名前に使ったら検査で誤り。
2. テスト用の管理表（その場で作る .xlsx）→ 取り込み（tools/xlsx_to_content.py）→ 解法の決定、を通しで確かめる。
3. data/techniques.json 全体：1問の主な解法は1つだけ・主な解法は結びつく解法（ids）に含まれる・
   管理表で名前を指定した問題は指定の先頭が主・「主な解法なし」の問題は主が無く nomain に載る・
   指定の無い問題はタグからの自動の規則どおり・指定の名前がすべて解法カードにある。
4. 判定の記録（link_review.csv）：「誤り」で外した問題はそのカードの主に戻っていない、
   「正しい」「新しく主に」「保留」の問題はそのカードの主のまま。
5. 管理表で指定した21件（spec_check.csv）：期待する主な解法と補助の解法がアプリのデータと一致する。
"""
import csv
import json
import shutil
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from build_app_data import NO_MAIN, select_techniques  # noqa: E402

REVIEWS = ['docs/audit/2026-11-23/techlinks/link_review.csv', 'docs/audit/2026-11-24/tangent/link_review.csv']
SPECS = 'docs/audit/2026-11-24/spec-nomain/spec_check.csv'
bad = []


def expect(cond, msg):
    if not cond:
        bad.append(msg)


# 1. 「解法」列の読み方（タグ a は解法 X の主になれる、タグ b は解法 Y の補助だけ）
t2t = {'a': [('X', False)], 'b': [('Y', True)]}
tn = {'X': 'X', 'Xの名前': 'X', 'Y': 'Y', 'Z': 'Z'}
expect(select_techniques(None, ['b', 'a'], t2t, tn) == ('auto', ['Y', 'X'], ['X'], []), '空欄はタグから自動（weak 以外の最初が主）')
expect(select_techniques([], ['b'], t2t, tn) == ('auto', ['Y'], [], []), '空欄で weak のタグだけなら主は無い（自動で主が無いもの）')
expect(select_techniques([NO_MAIN], ['a', 'b'], t2t, tn) == ('none', ['X', 'Y'], [], []), '「主な解法なし」は主を空に、タグの解法は補助として残す')
expect(select_techniques([NO_MAIN], [], t2t, tn) == ('none', [], [], []), '「主な解法なし」でタグが無ければ結びつきも無い')
expect(select_techniques(['Z', 'Xの名前'], ['b'], t2t, tn) == ('manual', ['Z', 'X'], ['Z'], []), '名前の並びは先頭が主・タグは使わない')
how, ms, main, errs = select_techniques(['Z', NO_MAIN], ['a'], t2t, tn)
expect(errs and not main, '「主な解法なし」を2番目以降に書いたら誤りで、主は選ばない')
how, ms, main, errs = select_techniques([NO_MAIN, 'Z'], ['a'], t2t, tn)
expect(errs and not main, '「主な解法なし」をほかの解法と並べたら誤りで、主は選ばない')
expect(select_techniques(['無い解法'], [], t2t, tn)[3] == ['無い解法'], '無い解法の名前は誤り')

# 予約語をカードの名前に使ったら検査で誤り（一時フォルダで1枚の名前を変えて確かめる）
import audit_techniques as AT  # noqa: E402
with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    (d / 'content').mkdir(); (d / 'data').mkdir()
    doc = json.loads((ROOT / 'content/techniques.json').read_text())
    doc['techniques'][0]['name'] = NO_MAIN
    (d / 'content/techniques.json').write_text(json.dumps(doc, ensure_ascii=False))
    for f in ('techniques.json', 'index.json'):
        shutil.copy(ROOT / 'data' / f, d / 'data' / f)
    E, _, _ = AT.check(d)
    expect(any(NO_MAIN in e for e in E), '予約語「主な解法なし」をカードの名前に使ったのに検査で誤りにならない')
E, _, rep = AT.check(ROOT)
expect(not E, '解法の検査の誤り：' + '／'.join(E[:3]))

# 2. テスト用の管理表 → 取り込み → 解法の決定
try:
    import openpyxl
    import xlsx_to_content as XC
except ImportError:
    openpyxl = None
    print('（openpyxl が無いので、取り込みの通しの確認は飛ばす）')
if openpyxl:
    tax = json.loads((ROOT / 'content/taxonomy.json').read_text())
    f0 = tax['fields'][0]
    rows = [('T-1', ''), ('T-2', NO_MAIN), ('T-3', 'Xの名前、Y'), ('T-4', f'{NO_MAIN}、X')]
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        (d / 'content').mkdir()
        shutil.copy(ROOT / 'content/taxonomy.json', d / 'content/taxonomy.json')
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = '問題一覧'
        ws.append(['ID', '科目', '分野', '難易度', '問題文（LaTeX）', '答え', 'タグ', '解法'])
        for pid, spec in rows:
            ws.append([pid, f0['subject'], f0['name'], 1, 'x', 'y', 'a、b', spec or None])
        wb.save(d / 't.xlsx')
        XC.convert(d / 't.xlsx', d / 'content')
        got = {p['id']: p.get('techniques') for f in (d / 'content/problems').glob('*.json') for p in json.loads(f.read_text())}
    expect(got == {'T-1': None, 'T-2': [NO_MAIN], 'T-3': ['Xの名前', 'Y'], 'T-4': [NO_MAIN, 'X']}, f'取り込んだ「解法」列が違う：{got}')
    res = {pid: select_techniques(spec, ['a', 'b'], t2t, tn) for pid, spec in got.items()}
    expect(res['T-1'][0] == 'auto' and res['T-1'][2] == ['X'], '取り込み後：空欄は自動')
    expect(res['T-2'][0] == 'none' and res['T-2'][2] == [] and res['T-2'][1] == ['X', 'Y'], '取り込み後：「主な解法なし」は主なし・補助あり')
    expect(res['T-3'][2] == ['X'], '取り込み後：名前の並びの先頭が主')
    expect(res['T-4'][3] and res['T-4'][2] == [], '取り込み後：「主な解法なし、X」は誤り')

# 3. 書き出したデータ全体の整合
data = json.loads((ROOT / 'data/techniques.json').read_text())
index = {e['id']: e for e in json.loads((ROOT / 'data/index.json').read_text())['problems']}
main, linked = defaultdict(list), defaultdict(list)
for t in data['techniques']:
    for i in t['main']:
        main[i].append(t['id'])
    for i in t['ids']:
        linked[i].append(t['id'])
for i, ms in main.items():
    expect(len(ms) == 1, f'{i} の主な解法が {len(ms)} つある（{ms}）')
    expect(all(m in linked[i] for m in ms), f'{i} の主な解法が結びつく解法に無い')
cards = json.loads((ROOT / 'content/techniques.json').read_text())['techniques']
name2id = {x: t['id'] for t in cards for x in [t['id'], t['name'], *t.get('former', [])]}
expect(NO_MAIN not in name2id, f'予約語「{NO_MAIN}」が解法カードの ID・名前・旧 ID にある')
specs = {}
for f in (ROOT / 'content/problems').glob('*.json'):
    for p in json.loads(f.read_text()):
        if p['quality']['status'] == 'published' and p['id'] in index:
            specs[p['id']] = p.get('techniques') or []
nomain = set(data.get('nomain', []))
expect(nomain == {i for i, s in specs.items() if s == [NO_MAIN]}, '「主な解法なし」の指定と data の nomain が合わない')
expect(set(data['manual']) == {i for i, s in specs.items() if s and s != [NO_MAIN]}, '名前の指定と data の manual が合わない')
# 指定の無い問題は、タグからの自動の規則どおり（content のタグと解法カードから同じ規則で作り直して比べる）
import tags as TG  # noqa: E402
cmap = TG.canonical_map(TG.load(ROOT / 'content'))
t2t, tn = {}, {}
for t in cards:
    for x in [t['id'], t['name'], *t.get('former', [])]:
        tn[x] = t['id']
    weak = {TG.to_canonical(w, cmap) for w in t.get('weak', [])}
    for tg in t['tags']:
        c = TG.to_canonical(tg, cmap)
        t2t.setdefault(c, []).append((t['id'], c in weak))
n_auto = 0
for i, spec in specs.items():
    how, ms, m, errs = select_techniques(spec, index[i].get('tg', []), t2t, tn)
    expect(not errs, f'{i}: 「解法」列の誤り {errs}')
    expect(main.get(i, []) == m, f'{i}: 主な解法が {main.get(i, [])}（規則では {m}・{how}）')
    expect(sorted(linked.get(i, [])) == sorted(ms), f'{i}: 結びつく解法が規則と違う')
    n_auto += how == 'auto'

# 4. 判定の記録
n = 0
for rel in REVIEWS:
    for r in csv.DictReader(open(ROOT / rel, encoding='utf-8-sig')):
        n += 1
        got = (main.get(r['問題ID']) or [None])[0]
        how = r.get('対応', '外した')
        if r['判定'] == '誤り' and how.startswith('外した'):
            expect(got != r['解法ID'], f'{r["問題ID"]} が「{r["解法"]}」の主な解法に戻っている（{r["根拠"]}）')
        if r['判定'] in ('正しい', '新しく主に', '保留'):
            expect(got == r['解法ID'], f'{r["問題ID"]} の主な解法が「{r["解法"]}」でなくなった（今は {got}。判定：{r["判定"]}）')

# 5. 管理表で指定した21件
k = 0
for r in csv.DictReader(open(ROOT / SPECS, encoding='utf-8-sig')):
    k += 1
    i = r['問題ID']
    want = r['期待する主な解法ID'] if r['期待する主な解法ID'] != 'なし' else None
    sup = sorted(x for x in r['期待する補助解法ID'].split('、') if x)
    expect((main.get(i) or [None])[0] == want, f'{i}: 主な解法が {main.get(i)}（期待 {want}）')
    expect(sorted(x for x in linked.get(i, []) if x != want) == sup, f'{i}: 補助の解法が {linked.get(i)}（期待 {sup}）')
    expect(specs.get(i) == r['管理表の解法列（復旧版コピー）'].split('、'), f'{i}: content の「解法」が管理表のコピーと違う')
expect(k == len(data['manual']) + len(nomain), f'spec_check.csv の {k}件と、指定のある問題 {len(data["manual"]) + len(nomain)}問が合わない')

for b in bad:
    print('✗', b)
print(f'判定の記録 {n}件・管理表の指定 {k}件（名前 {len(data["manual"])}・主な解法なし {len(nomain)}）・自動 {n_auto}問・'
      + ('OK' if not bad else f'{len(bad)}件合わない'))
sys.exit(1 if bad else 0)
