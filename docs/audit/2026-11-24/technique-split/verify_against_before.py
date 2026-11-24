#!/usr/bin/env python3
"""移行前（before_links.json：git HEAD d525360 のデータ）と今の data/techniques.json を全問比べる。

期待（このファイルに独立に書いたもの。実装の出力からは作らない）：
  - 主な解法・結びつく解法（集合）は、EXPECTED_CHANGES の問題を除いて全問同じ
  - EXPECTED_CHANGES の問題は書いたとおりの主・結びつきになる
  - manual は「移行前の manual ＋ 移行前の nomain（明示の指定に含めるようにしたため）＋ 明示に変えた問題」
  - nomain は「移行前の nomain ＋ 明示の主なしに変えた問題」
使い方：python3 verify_against_before.py [--step1]   （--step1 は3問を直す前＝移行だけの段階）
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
before = json.loads((HERE / 'before_links.json').read_text())
EXPECTED_CHANGES = {} if '--step1' in sys.argv else {
    # 問題ID: (主, 結びつく解法)。v0.29.0：主なしのまま、誤りだった「接線」を外し circle-tangent を補助に
    'A-GEO-017': (None, ['circle-tangent']),
    'I-TRI-081': (None, ['circle-tangent']),
    'II-GEO-254': (None, ['circle-tangent']),
}
data = json.loads((ROOT / 'data/techniques.json').read_text())
idx = [e['id'] for e in json.loads((ROOT / 'data/index.json').read_text())['problems']]
now = {i: {'main': None, 'links': []} for i in idx}
for t in data['techniques']:
    for i in t['ids']:
        now[i]['links'].append(t['id'])
    for i in t['main']:
        now[i]['main'] = t['id']
bad, same = [], 0
if set(now) != set(before['problems']):
    bad.append(f'問題の集合が違う：{sorted(set(now) ^ set(before["problems"]))[:5]}')
for i, b in before['problems'].items():
    n = now.get(i)
    if n is None:
        continue
    want = {'main': EXPECTED_CHANGES[i][0], 'links': sorted(EXPECTED_CHANGES[i][1])} if i in EXPECTED_CHANGES else b
    got = {'main': n['main'], 'links': sorted(n['links'])}
    if got != want:
        bad.append(f'{i}: 期待 {want} ／ 実際 {got}')
    elif i not in EXPECTED_CHANGES:
        same += 1
want_manual = set(before['manual']) | set(before['nomain']) | set(EXPECTED_CHANGES)
want_nomain = set(before['nomain']) | {i for i, (m, _) in EXPECTED_CHANGES.items() if m is None}
if set(data['manual']) != want_manual:
    bad.append(f'manual が違う：多い {sorted(set(data["manual"]) - want_manual)}・少ない {sorted(want_manual - set(data["manual"]))}')
if set(data['nomain']) != want_nomain:
    bad.append(f'nomain が違う：{sorted(set(data["nomain"]) ^ want_nomain)}')
for b in bad:
    print('✗', b)
print(f'全 {len(before["problems"])}問：変化なし {same}問・意図した変更 {len(EXPECTED_CHANGES)}問・違い {len(bad)}件'
      f'（manual {len(data["manual"])}・nomain {len(data["nomain"])}）')
sys.exit(1 if bad else 0)
