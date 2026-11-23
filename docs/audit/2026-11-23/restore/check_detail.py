#!/usr/bin/env python3
"""import_xlsx.py --check と同じ手順を一時フォルダで行い、data/ の違いを全件、項目ごとに数える（取り込みはしない）。

    python3 check_detail.py 復旧版.xlsx
"""
import csv, json, shutil, sys, tempfile
from collections import Counter
from pathlib import Path
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
sys.path.insert(0, str(REPO / 'tools'))
import import_xlsx as IX
import compare_data as CD
src = Path(sys.argv[1])
with tempfile.TemporaryDirectory() as tmp:
    tc, td = Path(tmp) / 'content', Path(tmp) / 'data'
    shutil.copytree(REPO / 'content', tc)
    IX.run(src, tc, td)
    r = CD.compare(REPO / 'data', td)
    cont = {p.relative_to(REPO / 'content').as_posix() for p in (REPO / 'content').rglob('*.json')
            if not (tc / p.relative_to(REPO / 'content')).exists() or (tc / p.relative_to(REPO / 'content')).read_bytes() != p.read_bytes()}
out = dict(removed=sorted(r.get('lost', [])), meta=r.get('meta'), orphan_bodies=r.get('orphan_bodies'), added=sorted(r.get('added', [])),
           changed_count=len(r.get('changed', [])), content_files_changed=sorted(cont))
kinds = Counter(); rows = []
for c in r.get('changed', []):
    pid, where, keys = c if isinstance(c, (list, tuple)) else (c['id'], c.get('where'), c.get('keys'))
    kinds[','.join(sorted(keys))] += 1
    rows.append([pid, where, ' '.join(sorted(keys))])
out['changed_by_keys'] = dict(kinds.most_common())
json.dump(out, open(HERE / 'check_detail.json', 'w'), ensure_ascii=False, indent=1)
with open(HERE / 'check_changed.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f); w.writerow(['問題ID', '場所', '違う項目']); w.writerows(rows)
print(json.dumps({k: (v if not isinstance(v, list) or len(v) < 12 else f'{len(v)}件') for k, v in out.items()}, ensure_ascii=False, indent=1))
