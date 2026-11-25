#!/usr/bin/env python3
"""同期済み管理表（正本）と原本を比べ，PR #3 の内容と照合する。

    python3 check_xlsx.py 原本.xlsx 正本.xlsx リポジトリ PR3のSHA main のSHA > xlsx_check.json
"""
import io, json, subprocess, sys, zipfile
import openpyxl

orig, synced, repo, pr3, main = sys.argv[1:6]
out = {}

# 1. zip の部品：違うのはどれか
zo, zs = zipfile.ZipFile(orig), zipfile.ZipFile(synced)
no, ns = set(zo.namelist()), set(zs.namelist())
out['zip_parts'] = {'orig': len(no), 'synced': len(ns), 'only_orig': sorted(no - ns), 'only_synced': sorted(ns - no),
                    'differing': sorted(n for n in no & ns if zo.read(n) != zs.read(n))}

# 2. すべてのシート・すべてのセル（値と数式）を比べる
wo = openpyxl.load_workbook(orig, data_only=False)
ws_ = openpyxl.load_workbook(synced, data_only=False)
out['sheets'] = {'orig': wo.sheetnames, 'synced': ws_.sheetnames}
cell_diffs = []; dims = {}; formulas = 0
for name in wo.sheetnames:
    a, b = wo[name], ws_[name]
    dims[name] = [a.dimensions, b.dimensions, a.max_row, b.max_row, a.max_column, b.max_column]
    for r in range(1, max(a.max_row, b.max_row) + 1):
        for c in range(1, max(a.max_column, b.max_column) + 1):
            va, vb = a.cell(r, c).value, b.cell(r, c).value
            if isinstance(va, str) and va.startswith('='): formulas += 1
            if va != vb: cell_diffs.append((name, r, c))
out['dimensions'] = dims
out['formula_cells_in_orig'] = formulas

# 3. 違うセルが「PR #3 で変わった欄」だけで，値が PR #3 の JSON と一致するか
sh = ws_['問題一覧']; head = [x.value for x in sh[1]]
col = {h: i + 1 for i, h in enumerate(head)}
FIELD = {'答え': 'answer', '解答・解説': 'solution', '核となるアイデア': 'idea'}
def load(rev):
    files = subprocess.check_output(['git', 'ls-tree', '--name-only', rev, 'content/problems/'], cwd=repo, text=True).split()
    d = {}
    for f in files:
        for p in json.loads(subprocess.check_output(['git', 'show', f'{rev}:{f}'], cwd=repo)):
            d[p['id']] = {'answer': p['answer']['tex'], 'solution': p['solutions'][0]['tex'] if p['solutions'] else None,
                          'idea': p['idea']['tex'] if p.get('idea') else None, 'statement': p['statement']['tex']}
    return d
J3, JM = load(pr3), load(main)
expected = set()
for pid in J3:
    for h, k in FIELD.items():
        if J3[pid][k] != JM[pid][k]: expected.add((pid, h))
rowid = {sh.cell(r, col['ID']).value: r for r in range(2, sh.max_row + 1) if sh.cell(r, col['ID']).value}
got = set(); bad = []
inv = {v: k for k, v in col.items()}
for name, r, c in cell_diffs:
    if name != '問題一覧' or inv.get(c) not in FIELD: bad.append([name, r, c, inv.get(c)]); continue
    got.add((sh.cell(r, col['ID']).value, inv[c]))
match = []
for pid, h in sorted(expected):
    v = sh.cell(rowid[pid], col[h]).value
    match.append([pid, h, v == J3[pid][FIELD[h]]])
ids = [sh.cell(r, col['ID']).value for r in range(2, sh.max_row + 1) if sh.cell(r, col['ID']).value]
out['cells'] = {'differing_cells': len(cell_diffs), 'unexpected_cells': bad,
                'expected_changed_fields': len(expected), 'differing_equals_expected': got == expected,
                'synced_equals_pr3': match, 'all_match': all(m[2] for m in match)}
out['ids'] = {'rows_with_id': len(ids), 'unique': len(set(ids)), 'json_pr3': len(J3), 'same_set': set(ids) == set(J3)}
print(json.dumps(out, ensure_ascii=False, indent=1))
ok = (not out['zip_parts']['only_orig'] and not out['zip_parts']['only_synced'] and not bad and got == expected
      and out['cells']['all_match'] and out['sheets']['orig'] == out['sheets']['synced'] and len(ids) == len(set(ids)))
print('総合：', '合格' if ok else '不合格', file=sys.stderr)
sys.exit(0 if ok else 1)
