#!/usr/bin/env python3
"""解法カードの主な解法の結びつき（人が問題ごとに確かめたもの）が崩れていないかを確かめる。

判定の記録（link_review.csv）ごとに：
  「誤り」で、対応が「外した…」（または対応の列が無い）問題は、その解法カードの主な解法になっていない
  「正しい」「新しく主に」「保留」の問題は、その解法カードの主な解法のまま
あわせて data/techniques.json 全体について：
  1問の主な解法は1つだけ・主な解法は結びつく解法（ids）に含まれる・管理表で指定した問題は指定の先頭が主な解法
タグや解法カードの tags・weak・問題の「解法」を変えたときに、確かめた結びつきが元に戻っていないかを見る。
"""
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REVIEWS = ['docs/audit/2026-11-23/techlinks/link_review.csv', 'docs/audit/2026-11-24/tangent/link_review.csv']

data = json.loads((ROOT / 'data/techniques.json').read_text())
main, linked = defaultdict(list), defaultdict(set)
for t in data['techniques']:
    for i in t['main']:
        main[i].append(t['id'])
    for i in t['ids']:
        linked[i].add(t['id'])
bad = []

# 全体の整合
for i, ms in main.items():
    if len(ms) > 1:
        bad.append(f'{i} の主な解法が {len(ms)} つある（{ms}）')
    for m in ms:
        if m not in linked[i]:
            bad.append(f'{i} の主な解法 {m} が結びつく解法に無い')
name2id = {}
for t in json.loads((ROOT / 'content/techniques.json').read_text())['techniques']:
    for x in [t['id'], t['name'], *t.get('former', [])]:
        name2id[x] = t['id']
for f in (ROOT / 'content/problems').glob('*.json'):
    for p in json.loads(f.read_text()):
        if p.get('techniques') and p['quality']['status'] == 'published':
            want = name2id.get(p['techniques'][0])
            if main.get(p['id'], [None])[0] != want:
                bad.append(f'{p["id"]} は管理表で「{p["techniques"][0]}」を主な解法に指定しているが、今は {main.get(p["id"])}')

# 判定の記録
n = 0
for rel in REVIEWS:
    for r in csv.DictReader(open(ROOT / rel, encoding='utf-8-sig')):
        n += 1
        got = (main.get(r['問題ID']) or [None])[0]
        how = r.get('対応', '外した')
        if r['判定'] == '誤り' and how.startswith('外した') and got == r['解法ID']:
            bad.append(f'{r["問題ID"]} が「{r["解法"]}」の主な解法に戻っている（{r["根拠"]}）')
        if r['判定'] in ('正しい', '新しく主に', '保留') and got != r['解法ID']:
            bad.append(f'{r["問題ID"]} の主な解法が「{r["解法"]}」でなくなった（今は {got}。判定：{r["判定"]}）')
for b in bad:
    print('✗', b)
print(f'判定の記録 {n}件・全体の整合：' + ('OK' if not bad else f'{len(bad)}件合わない'))
sys.exit(1 if bad else 0)
