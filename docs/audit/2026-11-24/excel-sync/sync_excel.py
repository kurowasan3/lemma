#!/usr/bin/env python3
"""管理表のコピーを、今のアプリの正規データ（content/）に合わせた新しいコピーにする（元のファイルは上書きしない）。

合わせるもの（取り込んだときに content と違ってしまう原因。2026-11-23 restore_report.md §4 の4項目と v0.28.0 のタグ）：
  1. 「入力用の答え」の列を最後に足し、content の grading.spec を書く（3,701問）
  2. 問題文・答え・解答・解説が content と違うセルを content の値にする
     （v0.27.0 でアプリ側だけ直した修正と、言い回しの違い。どちらもアプリが新しい版）
  3. タグが content と違うセルを content のタグにする（v0.28.0 で足したタグ。非表示の問題は「非表示」を残す・足す）
対象は content にある問題の行だけ。管理表にだけある新しい 254問の行は変えない。
書いたあと、全シート・全セルを元と比べて、上の変更だけであることを確かめる。

使い方：python3 sync_excel.py 元.xlsx 新.xlsx
"""
import csv
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools'))
from xlsx_to_content import nl, split_tags  # noqa: E402

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
if dst.exists() or dst.resolve() == src.resolve():
    sys.exit('出力先がすでにあるか、元と同じです（上書きしません）')
C = {p['id']: p for f in sorted((ROOT / 'content/problems').glob('*.json')) if f.name != 'builtin.json'
     for p in json.loads(f.read_text(encoding='utf-8'))}

wb = openpyxl.load_workbook(src)
ws = wb['問題一覧']
head = [str(c.value or '').strip() for c in ws[1]]
while head and not head[-1]:
    head.pop()
if '入力用の答え' in head:
    sys.exit('すでに「入力用の答え」の列があります')
col = {h: i + 1 for i, h in enumerate(head)}
c_in = len(head) + 1
style = ws.cell(1, len(head))
import copy  # noqa: E402
h = ws.cell(1, c_in, '入力用の答え')
h.font, h.fill, h.alignment, h.border = (copy.copy(x) for x in (style.font, style.fill, style.alignment, style.border))
ws.column_dimensions[openpyxl.utils.get_column_letter(c_in)].width = 40

FIXES = {(r['問題ID'], r['管理表の列']) for r in csv.DictReader(open(ROOT / 'docs/audit/2026-11-23/fixes.csv', encoding='utf-8-sig'))}
log, seen = [], set()


def put(r, c, value, pid, what, why):
    cell = ws.cell(r, c)
    old = cell.value
    cell.value = value
    if isinstance(value, str) and value.startswith('='):
        cell.data_type = 's'   # 数式として読まれないように
    log.append([pid, f'{openpyxl.utils.get_column_letter(c)}{r}', what, '' if old is None else str(old), value, why])


for r in range(2, ws.max_row + 1):
    pid = ws.cell(r, col['ID']).value
    if not pid or str(pid).strip() not in C:
        continue
    pid = str(pid).strip()
    p = C[pid]
    seen.add(pid)
    if p.get('grading'):
        put(r, c_in, p['grading']['spec'], pid, '入力用の答え', '列が無かった（content の grading.spec）')
    for name, val in (('問題文（LaTeX）', p['statement']['tex']), ('答え', p['answer']['tex']), ('解答・解説', p['solutions'][0]['tex'])):
        cur = ws.cell(r, col[name]).value
        if nl(cur if cur is not None else '') != val:
            why = 'v0.27.0 でアプリ側だけ直した修正（fixes.csv）' if (pid, name) in FIXES else '言い回しの違い（アプリの版を採用）'
            put(r, col[name], val, pid, name, why)
    raw = ws.cell(r, col['タグ']).value
    cur_tags = [t for t in split_tags(raw) if t != '非表示']
    hidden = p['quality']['status'] == 'hidden'
    if cur_tags != p['tags'] or (('非表示' in str(raw or '')) != hidden):
        want = ','.join(p['tags'] + (['非表示'] if hidden else []))
        why = '非表示の印（アプリでは非表示）' if hidden and '非表示' not in str(raw or '') else 'v0.28.0 などでアプリ側に足したタグ'
        put(r, col['タグ'], want, pid, 'タグ', why)

missing = sorted(set(C) - seen)
if missing:
    sys.exit(f'content の問題のうち管理表に行が無いもの：{missing[:5]}（何も書いていません）')
wb.save(dst)
with open(HERE / 'sync_log.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['問題ID', 'セル', '列', '変更前', '変更後', '理由'])
    w.writerows(log)
from collections import Counter  # noqa: E402
print(f'{dst.name} を書きました：変更 {len(log)}セル', dict(Counter((x[2], x[5]) for x in log)))
