#!/usr/bin/env python3
"""管理表に無いアプリの問題（deleted_from_excel.txt）ごとに、管理表の全行と問題文を比べ、確認の区分の案を出す（読み取りだけ）。

    python3 review_missing.py 管理表.xlsx content 出力.csv

区分（案。決めるのは人）：
  重複の可能性 … 管理表に、問題文の類似 0.75 以上で答えも同じ行がある（統合の検討対象。意図的に消した可能性）
  類題あり     … 管理表に、問題文の類似 0.80 以上で答えが違う行がある（類題として両方残す候補）
  対応なし     … どちらも無い（誤って消えた可能性。復旧候補）
類似度は表記を正規化した問題文の SequenceMatcher.ratio。全行と比べる（前段の絞り込みはしない）。
"""
import csv, json, sys
from difflib import SequenceMatcher
from pathlib import Path
here = Path(__file__).resolve().parent
sys.argv = [sys.argv[0], sys.argv[1], sys.argv[2], '/tmp/_unused', *sys.argv[3:]]
src = (here / 'match.py').read_text().split('# ---------------------------------------------------------------- 照合')[0]
exec(src)
OUTCSV = sys.argv[4]
M = {m['app_id']: m for m in csv.DictReader(open(here / 'id_mapping.csv', encoding='utf-8-sig'))}
owner = {m['excel_id']: m['app_id'] for m in M.values() if m['match_category'] in 'ABD' or (m['match_category'] == 'E' and m['excel_id'] == m['app_id'])}
deleted = [l.strip() for l in open(here / 'deleted_from_excel.txt') if l.strip()]
ex = sorted((eid, n2(e['st']), n2(e['ans'])) for eid, e in exl.items())
rows = []
for aid in deleted:
    a, aa = n2(app[aid]['st']), n2(app[aid]['ans'])
    best, same_ans = (0.0, ''), (0.0, '')
    for eid, t, ans in ex:
        sm = SequenceMatcher(None, a, t, autojunk=False)
        floor = min(best[0], same_ans[0] if ans == aa else 1.0, 0.75)
        if sm.real_quick_ratio() < floor or sm.quick_ratio() < floor: continue
        r = sm.ratio()
        if r > best[0]: best = (r, eid)
        if ans == aa and r > same_ans[0]: same_ans = (r, eid)
    if same_ans[0] >= 0.75: kind, (s, eid) = '重複の可能性', same_ans
    elif best[0] >= 0.80: kind, (s, eid) = '類題あり', best
    else: kind, (s, eid) = '対応なし', best
    x = app[aid]
    rows.append([aid, x['field'], x['level'], M[aid]['match_category'], kind, eid, owner.get(eid, ''), f'{s:.2f}',
                 '同じ' if eid and n2(exl[eid]['ans']) == aa else '違う',
                 {'重複の可能性': '統合の検討対象（判断保留）', '類題あり': '類題として両方残す候補（判断保留）', '対応なし': '復旧候補'}[kind]])
with open(OUTCSV, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['app_id', 'field', 'level', 'match_category', '区分', '管理表の近い行', 'その行のアプリID', '問題文の類似', '答え', '扱いの案'])
    w.writerows(rows)
from collections import Counter
print(Counter(r[4] for r in rows))
