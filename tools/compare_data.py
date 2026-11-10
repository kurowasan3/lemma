#!/usr/bin/env python3
"""2つのアプリ用データ（data/ フォルダ）を問題単位で照合する。

    python3 tools/compare_data.py 旧data 新data

問題の並び順と、版の情報（generated・format・dataVersion・builtinUnits・_meta）は比べない。
消えた問題・増えた問題・中身が変わった問題・分野一覧の違いを表示し、違いがあれば終了コード 1。
"""
import json
import sys
from pathlib import Path

IGNORE = {'generated', 'format', 'dataVersion', 'builtinUnits', 'problems'}


def load(d):
    d = Path(d)
    idx = json.loads((d / 'index.json').read_text(encoding='utf-8'))
    bodies = {}
    for f in sorted(d.glob('f-*.json')):
        for k, v in json.loads(f.read_text(encoding='utf-8')).items():
            if k != '_meta':
                bodies[k] = (f.name, v)
    meta = {k: v for k, v in idx.items() if k not in IGNORE}
    return meta, {e['id']: e for e in idx['problems']}, bodies


def compare(old, new):
    (m0, e0, b0), (m1, e1, b1) = load(old), load(new)
    changed = []
    for i in sorted(e0.keys() & e1.keys()):
        if e0[i] != e1[i]:
            changed.append((i, '一覧', sorted(k for k in set(e0[i]) | set(e1[i]) if e0[i].get(k) != e1[i].get(k))))
        elif b0.get(i) != b1.get(i):
            x, y = b0.get(i, (None, {})), b1.get(i, (None, {}))
            keys = sorted(k for k in set(x[1]) | set(y[1]) if x[1].get(k) != y[1].get(k))
            changed.append((i, '本文', keys if keys else [f'ファイル {x[0]} → {y[0]}']))
    return {'lost': sorted(e0.keys() - e1.keys()), 'added': sorted(e1.keys() - e0.keys()), 'changed': changed,
            'meta': sorted(k for k in set(m0) | set(m1) if m0.get(k) != m1.get(k)),
            'orphan_bodies': sorted((b1.keys() - e1.keys()) | (b0.keys() - e0.keys()))}


def report(r):
    ok = not (r['lost'] or r['added'] or r['changed'] or r['meta'] or r['orphan_bodies'])
    print('一致しました' if ok else '違いがあります')
    for name, key in [('消えた問題', 'lost'), ('増えた問題', 'added'), ('一覧と本文が合わない', 'orphan_bodies')]:
        if r[key]:
            print(f'  {name} {len(r[key])}件:', ', '.join(r[key][:20]), '…' if len(r[key]) > 20 else '')
    if r['meta']:
        print('  index.json の違い:', ', '.join(r['meta']))
    for i, where, keys in r['changed'][:30]:
        print(f'  変わった問題 {i}（{where}）:', ', '.join(keys))
    if len(r['changed']) > 30:
        print(f'  …ほか {len(r["changed"]) - 30}件')
    return ok


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    sys.exit(0 if report(compare(sys.argv[1], sys.argv[2])) else 1)
