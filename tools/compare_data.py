#!/usr/bin/env python3
"""2つのアプリ用データ（data/ フォルダ）を問題単位で照合する。

    python3 tools/compare_data.py 旧data 新data

問題の並び順と、版の情報（generated・format・dataVersion・builtinUnits・_meta）は比べない。
本文の置き方（分野ごとの f-*.json か，v0.32 からの塊 b/*.json か）にも依らず，問題IDごとの本文の中身で比べる。
消えた問題・増えた問題・中身が変わった問題（キー名つき）・分野一覧の違いを表示し、違いがあれば終了コード 1。
それぞれの data/ がそろっていないとき（本文が無い・2つある・塊のファイルが無い・ハッシュが合わない）も「整合しない」として 1。
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_app_data import load_bodies_checked  # noqa: E402

IGNORE = {'generated', 'format', 'dataVersion', 'builtinUnits', 'problems', 'bodies'}   # bodies（本文の置き方）は問題ごとの本文で比べる


def load(d):
    idx, bodies, errs = load_bodies_checked(d)
    meta = {k: v for k, v in idx.items() if k not in IGNORE}
    return meta, {e['id']: e for e in idx['problems']}, bodies, errs


def compare(old, new):
    (m0, e0, b0, x0), (m1, e1, b1, x1) = load(old), load(new)
    changed = []
    for i in sorted(e0.keys() & e1.keys()):
        if e0[i] != e1[i]:
            changed.append((i, '一覧', sorted(k for k in set(e0[i]) | set(e1[i]) if e0[i].get(k) != e1[i].get(k))))
        elif b0.get(i, (None, None))[1] != b1.get(i, (None, None))[1]:   # 置き場所（ファイル名）の違いは比べない
            x, y = b0.get(i, (None, {})), b1.get(i, (None, {}))
            keys = sorted(k for k in set(x[1]) | set(y[1]) if x[1].get(k) != y[1].get(k))
            changed.append((i, '本文', keys if keys else [f'ファイル {x[0]} → {y[0]}']))
    return {'lost': sorted(e0.keys() - e1.keys()), 'added': sorted(e1.keys() - e0.keys()), 'changed': changed,
            'meta': sorted(k for k in set(m0) | set(m1) if m0.get(k) != m1.get(k)),
            'orphan_bodies': sorted((b1.keys() - e1.keys()) | (b0.keys() - e0.keys())),
            'broken': [f'旧：{x}' for x in x0] + [f'新：{x}' for x in x1]}


def report(r):
    ok = not (r['lost'] or r['added'] or r['changed'] or r['meta'] or r['orphan_bodies'] or r.get('broken'))
    print('一致しました' if ok else '違いがあります')
    if r.get('broken'):
        print(f'  data/ が整合しない {len(r["broken"])}件（本文の欠け・重複・ハッシュ）:')
        for x in r['broken'][:20]:
            print('   ', x)
        if len(r['broken']) > 20:
            print(f'    …ほか {len(r["broken"]) - 20}件')
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
