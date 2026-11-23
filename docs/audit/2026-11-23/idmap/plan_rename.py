#!/usr/bin/env python3
"""管理表の ID をアプリの ID に合わせるための対応表（案）を作り、確かめる（読み取りだけ。管理表は書き換えない）。

    python3 plan_rename.py 管理表.xlsx content

出力（このフォルダ）：
  excel_rename_plan.csv … 管理表の全行：行番号・今のID・合わせた後のID・根拠
  excel_restore_plan.csv … 管理表に無いアプリの問題（558）：管理表に戻す行の ID と、確認の区分（missing_review.csv）
規則：
  - A・B・同じIDの E：ID はそのまま
  - D：id_mapping.csv の app_id にする（問題文・答え・解説が一致したもの）
  - 管理表にだけある行（254）：今の ID をアプリが一度も使っていなければそのまま。使っていれば、その分野の接頭辞（taxonomy の idPrefix）で、
    アプリと管理表のどちらでも使われた最大の番号の次から順に新しい番号を付ける（既存の ID を再利用しない）
"""
import csv
import json
import re
import subprocess
import sys
import warnings
from collections import Counter, defaultdict
from pathlib import Path

warnings.filterwarnings('ignore')
import openpyxl

here = Path(__file__).resolve().parent
XLSX, CONTENT = sys.argv[1], Path(sys.argv[2])
REPO = CONTENT.resolve().parent
tax = json.loads((CONTENT / 'taxonomy.json').read_text())
prefix_of = {f['key']: f['idPrefix'] for f in tax['fields']}
fkey = {(f['subject'], f['name']): f['key'] for f in tax['fields']}

M = {m['app_id']: m for m in csv.DictReader(open(here / 'id_mapping.csv', encoding='utf-8-sig'))}
UE = {u['excel_id']: u for u in csv.DictReader(open(here / 'unmatched_excel.csv', encoding='utf-8-sig'))}
MR = {r['app_id']: r for r in csv.DictReader(open(here / 'missing_review.csv', encoding='utf-8-sig'))}
app = {}
for f in (CONTENT / 'problems').glob('*.json'):
    if f.name != 'builtin.json':
        for x in json.loads(f.read_text()):
            app[x['id']] = x

# アプリが過去に使った ID（Git の全コミット）
ever = set(app)
revs = subprocess.run(['git', '-C', str(REPO), 'rev-list', 'HEAD', '--', 'content/problems'], capture_output=True, text=True).stdout.split()
for r in revs:
    for n in subprocess.run(['git', '-C', str(REPO), 'ls-tree', '--name-only', r, 'content/problems/'], capture_output=True, text=True).stdout.split():
        if not n.endswith('builtin.json'):
            ever |= {x['id'] for x in json.loads(subprocess.run(['git', '-C', str(REPO), 'show', f'{r}:{n}'], capture_output=True, text=True).stdout)}

ws = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)['問題一覧']
rows = list(ws.iter_rows(values_only=True))
head = [str(c or '').strip() for c in rows[0]]
ci = {h: i for i, h in enumerate(head)}
excel = []
for n, r in enumerate(rows[1:], start=2):
    if r[0]:
        excel.append(dict(row=n, id=str(r[0]).strip(), field=fkey.get((str(r[ci['科目']] or ''), str(r[ci['分野']] or '')), '')))
excel_ids = {e['id'] for e in excel}

ex2app = {}
for m in M.values():
    if m['match_category'] in 'ABD' or (m['match_category'] == 'E' and m['excel_id'] == m['app_id']):
        ex2app[m['excel_id']] = (m['app_id'], m['match_category'])

# 新しい番号の起点：接頭辞ごとに、アプリ（過去を含む）・管理表で使われた最大の番号
maxn = defaultdict(int)
for i in ever | excel_ids:
    mm = re.fullmatch(r'([A-Z]+-[A-Z]+)-(\d+)', i)
    if mm:
        maxn[mm.group(1)] = max(maxn[mm.group(1)], int(mm.group(2)))

plan, notes = [], []
for e in excel:
    if e['id'] in ex2app:
        aid, cat = ex2app[e['id']]
        basis = {'A': '一致（そのまま）', 'B': '問題文が一致（そのまま。答え・解説は v0.27.0 の修正を反映する）',
                 'D': '問題文・答え・解説が一致（ID だけ違う）', 'E': '同じ ID（問題文の言い回しが違う。どちらの文を残すかは人が決める）'}[cat]
        plan.append([e['row'], e['id'], aid, cat, basis])
    elif e['id'] in UE:
        p = prefix_of.get(e['field'], '')
        cur_p = e['id'].rsplit('-', 1)[0]
        if p and cur_p != p:
            notes.append(f'{e["id"]}：分野 {e["field"]} の接頭辞は {p}')
        if e['id'] not in ever:
            plan.append([e['row'], e['id'], e['id'], '新規', 'アプリで一度も使っていない ID なのでそのまま'])
        else:
            maxn[p] += 1
            nid = f'{p}-{maxn[p]:03d}'
            plan.append([e['row'], e['id'], nid, '新規', f'今の ID はアプリで別の問題が使っているので、{p} の未使用の番号を付ける'])
    else:
        notes.append(f'行 {e["row"]} {e["id"]} が分類に無い')

restore = []
for aid in [l.strip() for l in open(here / 'deleted_from_excel.txt') if l.strip()]:
    r = MR[aid]
    restore.append([aid, app[aid]['field'], app[aid]['level'], (app[aid].get('provenance') or {}).get('created', ''), r['区分'], r['管理表の近い行'], r['その行のアプリID'], r['問題文の類似'], r['扱いの案']])

# ---------------------------------------------------------------- 確かめる
after = [p[2] for p in plan]
fails = []
def check(name, ok, detail=''):
    print(('✓ ' if ok else '✗ ') + name + (f'：{detail}' if detail else ''))
    if not ok: fails.append(name)

check('管理表の全行に、合わせた後の ID がある', len(plan) == len(excel), f'{len(plan)}行')
check('合わせた後の ID に重複がない', len(set(after)) == len(after))
check('アプリの ID を付ける行は、そのアプリの問題と内容が一致した行だけ', all(p[2] in app and p[3] in 'ABDE' for p in plan if p[2] in app))
check('新しい ID は、アプリが過去を含めて一度も使っていない', all(p[2] not in ever for p in plan if p[3] == '新規'))
check('新しい ID は、管理表の他の行の今の ID とも重ならない', all(p[2] == p[1] or p[2] not in excel_ids for p in plan if p[3] == '新規'))
check('管理表に戻す行の ID は、合わせた後の管理表に無い', not (set(r[0] for r in restore) & set(after)))
total = set(after) | {r[0] for r in restore}
check('合わせて戻した後の管理表＝アプリの全問題＋新しい問題', set(app) <= total and len(total) == len(app) + sum(p[3] == '新規' for p in plan),
      f'{len(after)} + {len(restore)} = {len(total)}（アプリ {len(app)}・新規 {sum(p[3] == "新規" for p in plan)}）')
for n in notes:
    print('  注意：' + n)
cnt = Counter((p[3], p[1] == p[2]) for p in plan)
print('内訳：', {f'{k[0]}{"（ID そのまま）" if k[1] else "（ID 変更）"}': v for k, v in sorted(cnt.items())})

def W(name, head_, rows_):
    with open(here / name, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(head_); w.writerows(rows_)
W('excel_rename_plan.csv', ['管理表の行', '今のID', '合わせた後のID', '分類', '根拠'], plan)
W('excel_restore_plan.csv', ['アプリのID（戻す行のID）', '分野', '難易度', '作成日', '区分', '管理表の近い行', 'その行のアプリID', '問題文の類似', '扱いの案'], restore)
sys.exit(1 if fails else 0)
