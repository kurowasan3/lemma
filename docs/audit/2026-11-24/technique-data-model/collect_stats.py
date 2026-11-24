#!/usr/bin/env python3
"""解法の結びつきの現状を集計する（読むだけ。何も書きかえない）。

読むもの：content/problems/*.json（管理表の「解法」列＝techniques、タグ）、content/techniques.json（カード・tags・weak）、
          data/index.json・data/techniques.json（ビルド結果：main・ids・manual・nomain）。
書くもの：このフォルダの stats.csv（集計）と problem_states.csv（問題ごとの状態）。
使い方：python3 docs/audit/2026-11-24/technique-data-model/collect_stats.py
"""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools'))
from build_app_data import NO_MAIN, select_techniques  # noqa: E402
import tags as TG  # noqa: E402

index = json.loads((ROOT / 'data/index.json').read_text())['problems']
data = json.loads((ROOT / 'data/techniques.json').read_text())
cards = json.loads((ROOT / 'content/techniques.json').read_text())['techniques']
content = {p['id']: p for f in sorted((ROOT / 'content/problems').glob('*.json')) for p in json.loads(f.read_text())}

ids_in_index = [e['id'] for e in index]
kinds = Counter(e.get('kind', 'content') for e in index)
main, linked = {}, {}
for t in data['techniques']:
    for i in t['main']:
        main.setdefault(i, []).append(t['id'])
    for i in t['ids']:
        linked.setdefault(i, []).append(t['id'])
manual, nomain = set(data['manual']), set(data['nomain'])

# タグからの自動の規則（build_app_data.py と同じ）を作り直して、weak だけに当たる問題を数える
cmap = TG.canonical_map(TG.load(ROOT / 'content'))
t2t, tn = {}, {}
for t in cards:
    for x in [t['id'], t['name'], *t.get('former', [])]:
        tn[x] = t['id']
    weak = {TG.to_canonical(w, cmap) for w in t.get('weak', [])}
    for tg in t['tags']:
        c = TG.to_canonical(tg, cmap)
        t2t.setdefault(c, []).append((t['id'], c in weak))

rows, stat = [], Counter()
dup_spec, unknown_ref, bad_pos = [], [], []
for e in index:
    i = e['id']
    p = content.get(i, {})
    spec = p.get('techniques') or []
    m = main.get(i, [])
    sup = [x for x in linked.get(i, []) if x not in m]
    how = 'nomain' if i in nomain else 'manual' if i in manual else 'auto'
    state = ('A' if not sup else 'B') if m else ('C' if not sup else 'D')
    stat[f'state_{state}'] += 1
    stat[f'how_{how}'] += 1
    stat[f'state_{state}_{how}'] += 1
    if len(m) > 1:
        stat['main_multiple'] += 1
    if set(m) & set(sup):
        stat['main_and_sup_overlap'] += 1
    if spec and len(spec) != len(set(tn.get(x, x) for x in spec)):
        dup_spec.append(i)
    for x in spec:
        if x != NO_MAIN and x not in tn:
            unknown_ref.append((i, x))
    if NO_MAIN in spec and spec != [NO_MAIN]:
        bad_pos.append(i)
    # 自動の問題で、主が無いのに補助がある理由（weak だけに当たる）
    if how == 'auto' and not m and sup:
        hits = [h for tg in e.get('tg', []) for h in t2t.get(tg, [])]
        if hits and all(w for _, w in hits):
            stat['D_auto_weak_only'] += 1
    rows.append([i, e.get('f'), e.get('kind', 'content'), how, state, '、'.join(m), '、'.join(sup), '、'.join(spec)])

stat['problems_index'] = len(ids_in_index)
for k, v in kinds.items():
    stat[f'kind_{k}'] = v
stat['with_main'] = sum(1 for i in ids_in_index if main.get(i))
stat['without_main'] = sum(1 for i in ids_in_index if not main.get(i))
stat['with_support'] = sum(1 for i in ids_in_index if [x for x in linked.get(i, []) if x not in main.get(i, [])])
stat['linked_any'] = sum(1 for i in ids_in_index if linked.get(i))
stat['spec_duplicate_card'] = len(dup_spec)
stat['spec_unknown_card'] = len(unknown_ref)
stat['spec_nomain_bad_position'] = len(bad_pos)
stat['cards'] = len(cards)
stat['cards_without_tags'] = sum(1 for t in cards if not t.get('tags'))
stat['cards_with_weak'] = sum(1 for t in cards if t.get('weak'))
stat['links_total'] = sum(len(t['ids']) for t in data['techniques'])
stat['links_main'] = sum(len(t['main']) for t in data['techniques'])
stat['data_ids_not_in_index'] = sum(1 for t in data['techniques'] for i in t['ids'] if i not in set(ids_in_index))

with open(OUT / 'stats.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['項目', '値'])
    for k in sorted(stat):
        w.writerow([k, stat[k]])
with open(OUT / 'problem_states.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['問題ID', '分野', '種類', '決め方（auto/manual/nomain）', '状態（A〜D）', '主な解法', '補助の解法（データの順）', '管理表の解法列'])
    w.writerows(rows)
for k in sorted(stat):
    print(k, stat[k])
print('spec の重複', dup_spec, '無い名前', unknown_ref, '予約語の位置', bad_pos)
