#!/usr/bin/env python3
"""解法カードの主な解法の結びつき（人が問題ごとに確かめたもの）が崩れていないかを確かめる。

docs/audit/2026-11-23/techlinks/link_review.csv で
  「誤り」と判定した問題は、その解法カードの主な解法になっていない
  「正しい」「新しく主に」と判定した問題は、その解法カードの主な解法になっている
タグや解法カードの tags・weak を変えたときに、確かめた結びつきが元に戻っていないかを見る。
"""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
rows = list(csv.DictReader(open(ROOT / 'docs/audit/2026-11-23/techlinks/link_review.csv', encoding='utf-8-sig')))
main = {}
for t in json.loads((ROOT / 'data/techniques.json').read_text())['techniques']:
    for i in t['main']:
        main[i] = t['id']
bad = []
for r in rows:
    got = main.get(r['問題ID'])
    if r['判定'] == '誤り' and got == r['解法ID']:
        bad.append(f'{r["問題ID"]} が「{r["解法"]}」の主な解法に戻っている（{r["根拠"]}）')
    if r['判定'] in ('正しい', '新しく主に') and got != r['解法ID']:
        bad.append(f'{r["問題ID"]} の主な解法が「{r["解法"]}」でなくなった（今は {got}）')
for b in bad:
    print('✗', b)
print(f'{len(rows) - len(bad)} / {len(rows)} OK')
sys.exit(1 if bad else 0)
