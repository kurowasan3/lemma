#!/usr/bin/env python3
"""v0.29.0 の1回だけの移行：content/problems の techniques（旧「解法」列）→ technique_main・technique_support。

  [X, Y, …]        → technique_main: X、technique_support: [Y, …]（並びを保つ。[X] だけなら []）
  ["主な解法なし"] → technique_main: null、technique_support: 今タグから付いている解法（移行前と同じ結びつきにするため、
                     build_app_data.py の自動の規則で求めた順に名前で書く）
自動の問題（techniques の無い問題）には何も足さない。techniques は消し、同じ位置に新しい2項目を置く。
使い方：python3 docs/audit/2026-11-24/technique-split/migrate_content.py [--check]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'tools'))
import tags as TG  # noqa: E402

NO_MAIN = '主な解法なし'
cards = json.loads((ROOT / 'content/techniques.json').read_text())['techniques']
name = {t['id']: t['name'] for t in cards}
cmap = TG.canonical_map(TG.load(ROOT / 'content'))
t2t = {}
for t in cards:
    weak = {TG.to_canonical(w, cmap) for w in t.get('weak', [])}
    for tg in t['tags']:
        t2t.setdefault(TG.to_canonical(tg, cmap), []).append(t['id'])


def tag_links(p):
    tg = list(dict.fromkeys(TG.to_canonical(t, cmap) for t in p['tags']))
    return list(dict.fromkeys(c for x in tg for c in t2t.get(x, [])))


check = '--check' in sys.argv
log = []
for f in sorted((ROOT / 'content/problems').glob('*.json')):
    raw = f.read_text()
    items = json.loads(raw)
    assert json.dumps(items, ensure_ascii=False, indent=1) + '\n' == raw, f
    changed = False
    for k, p in enumerate(items):
        if 'techniques' not in p:
            continue
        spec = p['techniques']
        if spec == [NO_MAIN]:
            main, sup = None, [name[c] for c in tag_links(p)]
        else:
            assert NO_MAIN not in spec, p['id']
            main, sup = spec[0], spec[1:]
        q = {}
        for key, v in p.items():
            if key == 'techniques':
                q['technique_main'] = main
                q['technique_support'] = sup
            else:
                q[key] = v
        items[k] = q
        changed = True
        log.append({'id': p['id'], 'before': spec, 'technique_main': main, 'technique_support': sup})
    if changed and not check:
        f.write_text(json.dumps(items, ensure_ascii=False, indent=1) + '\n')
out = Path(__file__).resolve().parent / 'migration_log.json'
if not check:
    out.write_text(json.dumps(log, ensure_ascii=False, indent=1) + '\n')
print(f'{"確認のみ：" if check else ""}{len(log)}問を移行')
