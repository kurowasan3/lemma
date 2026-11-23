#!/usr/bin/env python3
"""管理表の復旧版を、元の管理表・content/・Git から読み直して確かめる（読み取りだけ）。

    python3 verify_restored.py 元の管理表.xlsx 復旧版.xlsx

ログの件数ではなく、復旧版のファイルそのものを読み直して判定する。結果は restore_validation.json。
"""
import csv
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import warnings
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

warnings.filterwarnings('ignore')
import openpyxl

ORIG, REST = Path(sys.argv[1]), Path(sys.argv[2])
HERE = Path(__file__).resolve().parent
IDMAP = HERE.parent / 'idmap'
REPO = HERE.parents[3]
fails, res = [], {}

def check(name, ok, detail=''):
    print(('✓ ' if ok else '✗ ') + name + (f'：{detail}' if detail else ''))
    if not ok: fails.append(name)

res['original_sha256'] = hashlib.sha256(ORIG.read_bytes()).hexdigest()
res['restored_sha256'] = hashlib.sha256(REST.read_bytes()).hexdigest()
check('元の管理表は変わっていない', res['original_sha256'] == '62723082d679eb284e49d6f29b40ffb391953bc32366819432d8b5461c6ba733', res['original_sha256'][:16] + '…')

# ---------------------------------------------------------------- ファイルの構造
zo, zr = zipfile.ZipFile(ORIG), zipfile.ZipFile(REST)
check('zip の部品の並びが同じ', [i.filename for i in zo.infolist()] == [i.filename for i in zr.infolist()])
changed = [n for n in zo.namelist() if zo.read(n) != zr.read(n)]
check('変わった部品は 問題一覧 と 共有文字列 だけ', sorted(changed) == ['xl/sharedStrings.xml', 'xl/worksheets/sheet2.xml'], str(changed))
bad_xml = []
for n in zr.namelist():
    if n.endswith('.xml') or n.endswith('.rels') or n.endswith('.vml'):
        try: ET.fromstring(zr.read(n))
        except ET.ParseError as e: bad_xml.append(f'{n}: {e}')
check('すべての XML が正しく読める', not bad_xml, '; '.join(bad_xml[:3]))
so, sr = zo.read('xl/worksheets/sheet2.xml').decode(), zr.read('xl/worksheets/sheet2.xml').decode()
tail = lambda s: s[s.index('</sheetData>'):]
t_o, t_r = tail(so), tail(sr)
check('シートの後半（入力規則・条件付き書式・印刷設定・図）は、条件付き書式の範囲1か所だけ違う',
      t_o.replace('COUNTIF($A$2:$A$5000,A3)', 'COUNTIF($A$2:$A$10000,A3)') == t_r)
head = lambda s: s[:s.index('<sheetData>')]
check('シートの前半（列幅・固定枠など）は dimension だけ違う',
      head(so).replace('<dimension ref="A1:S4914"/>', '<dimension ref="A1:S5472"/>') == head(sr))

# ---------------------------------------------------------------- openpyxl で読み直す
wo = openpyxl.load_workbook(ORIG, data_only=True)
wr = openpyxl.load_workbook(REST, data_only=True)
wf = openpyxl.load_workbook(REST)              # 数式も読む
check('シートの構成が同じ', wo.sheetnames == wr.sheetnames, str(wr.sheetnames))
for s in wo.sheetnames:
    if s == '問題一覧': continue
    a = [[c.value for c in r] for r in wo[s].iter_rows()]
    b = [[c.value for c in r] for r in wr[s].iter_rows()]
    check(f'シート「{s}」は変わっていない', a == b)
po, pr, pf = wo['問題一覧'], wr['問題一覧'], wf['問題一覧']
check('問題一覧の入力規則・条件付き書式の数が同じ',
      len(po.data_validations.dataValidation) == len(pr.data_validations.dataValidation) and len(po.conditional_formatting) == len(pr.conditional_formatting))
head_row = [c.value for c in pr[1]]
check('見出し行が同じ', head_row == [c.value for c in po[1]])
col = {h: i for i, h in enumerate(head_row)}
rows_o = [[c.value for c in r] for r in po.iter_rows(min_row=2) if r[0].value is not None]
rows_r = [[c.value for c in r] for r in pr.iter_rows(min_row=2) if r[0].value is not None]
rows_rf = [[c.value for c in r] for r in pf.iter_rows(min_row=2) if r[0].value is not None]
res['rows'] = dict(before=len(rows_o), after=len(rows_r))
check('行数：4,913 → 5,471', len(rows_o) == 4913 and len(rows_r) == 5471, f'{len(rows_o)} → {len(rows_r)}')

# 既存の行：ID 以外は同じ。ID は id_rename_log.csv のとおり
ren = {int(r['管理表の行']): (r['変更前のID'], r['変更後のID']) for r in csv.DictReader(open(HERE / 'id_rename_log.csv', encoding='utf-8-sig'))}
other_diff, id_diff, id_ok = [], 0, 0
for k, (a, b) in enumerate(zip(rows_o, rows_r)):
    n = k + 2
    if a[1:] != b[1:]: other_diff.append(n)
    if a[0] != b[0]:
        id_diff += 1
        if ren.get(n) == (str(a[0]).strip(), b[0]): id_ok += 1
check('既存の行は ID 以外のセルが変わっていない', not other_diff, f'違う行 {len(other_diff)}' + (f'（{other_diff[:5]}）' if other_diff else ''))
check('既存の行の ID の変更＝id_rename_log.csv', id_diff == len(ren) == id_ok, f'{id_diff} 行（ログ {len(ren)}・一致 {id_ok}）')
res['renamed'] = id_diff

# 数式（Q 列）
qcol = col['検証済み']
qf = [r[qcol] for r in rows_rf]
check('検証済み（Q 列）は全行が数式', all(isinstance(v, str) and v.startswith('=IF(') for v in qf), f'{sum(isinstance(v, str) and v.startswith("=IF(") for v in qf)} 行')

# ---------------------------------------------------------------- ID
ids = [str(r[0]).strip() for r in rows_r]
check('ID の空欄なし', all(ids), f'空欄 {sum(not i for i in ids)}')
dupe = [i for i, c in Counter(ids).items() if c > 1]
check('ID の重複なし', not dupe, f'重複 {len(dupe)}')
res['ids'] = dict(total=len(ids), unique=len(set(ids)), empty=sum(not i for i in ids), duplicates=len(dupe))
for h in ('問題文（LaTeX）', '答え', '解答・解説'):
    empty = [ids[k] for k, r in enumerate(rows_r) if r[col[h]] is None or not str(r[col[h]]).strip()]
    check(f'「{h}」の空欄なし', not empty, f'空欄 {len(empty)}')

app = {}
for f in (REPO / 'content/problems').glob('*.json'):
    if f.name != 'builtin.json':
        for x in json.loads(f.read_text()): app[x['id']] = x
check('アプリの全 ID が復旧版にある（学習記録が参照する ID が残る）', set(app) <= set(ids), f'無い ID {len(set(app) - set(ids))}')
newids = set(ids) - set(app)
check('アプリに無い ID＝管理表にだけある 254問', len(newids) == 254, f'{len(newids)}')
ever = set(app)
for r in subprocess.run(['git', '-C', str(REPO), 'rev-list', 'HEAD', '--', 'content/problems'], capture_output=True, text=True).stdout.split():
    for n in subprocess.run(['git', '-C', str(REPO), 'ls-tree', '--name-only', r, 'content/problems/'], capture_output=True, text=True).stdout.split():
        if not n.endswith('builtin.json'):
            ever |= {x['id'] for x in json.loads(subprocess.run(['git', '-C', str(REPO), 'show', f'{r}:{n}'], capture_output=True, text=True).stdout)}
check('新しい 254問の ID はアプリが過去を含めて一度も使っていない', not (newids & ever))
orig_ids = {str(r[0]).strip() for r in rows_o}
changed_new = {r['割り当てたID'] for r in csv.DictReader(open(HERE / 'new_id_assignment.csv', encoding='utf-8-sig')) if r['ID'] == '変更'}
check('新しく付けた番号は、元の管理表の ID とも重ならない', not (changed_new & orig_ids), f'{len(changed_new)} 件')

# ---------------------------------------------------------------- 内容：復旧版から content を作り直して、アプリと比べる
tmp = Path(tempfile.mkdtemp())
shutil.copytree(REPO / 'content', tmp / 'content')
r = subprocess.run([sys.executable, str(REPO / 'tools/xlsx_to_content.py'), str(REST), str(tmp / 'content')], capture_output=True, text=True)
check('xlsx_to_content.py で読める（一時フォルダ）', r.returncode == 0, (r.stderr or r.stdout)[-200:] if r.returncode else '')
gen = {}
for f in (tmp / 'content/problems').glob('*.json'):
    if f.name != 'builtin.json':
        for x in json.loads(f.read_text()): gen[x['id']] = x
shutil.rmtree(tmp)
FIX = {}
for row in list(csv.reader(open(REPO / 'docs/audit/2026-11-23/fixes.csv', encoding='utf-8-sig')))[1:]:
    FIX.setdefault(row[0], set()).add({'問題文（LaTeX）': 'statement', '答え': 'answer', '解答・解説': 'solutions'}[row[3]])
M = {m['app_id']: m for m in csv.DictReader(open(IDMAP / 'id_mapping.csv', encoding='utf-8-sig'))}
wording = {i for i, m in M.items() if m['match_category'] == 'E' and m['excel_id'] == i and i not in FIX}
restored = {r['アプリのID'] for r in csv.DictReader(open(HERE / 'restore_558_log.csv', encoding='utf-8-sig'))}
KEYS = ['field', 'level', 'minutes', 'theme', 'unit', 'topic', 'statement', 'answer', 'solutions', 'idea', 'methods', 'tags', 'provenance', 'figure', 'value', 'techniques']
diff_kind, unexpected = Counter(), []
for i, a in app.items():
    g = gen.get(i)
    if g is None: unexpected.append(f'{i}：作り直すと無い'); continue
    d = {k for k in KEYS if a.get(k) != g.get(k)}
    qa, qg = a['quality'], g['quality']
    if (qa['status'], qa['checks'], qa.get('verified')) != (qg['status'], qg['checks'], qg.get('verified')): d.add('quality')
    gr = a.get('grading') != g.get('grading')
    if gr: diff_kind['入力用の答え（列が無い）'] += 1
    if not d: diff_kind['一致（入力用の答え以外）'] += 1; continue
    if i in FIX and d <= FIX[i]: diff_kind['v0.27.0 の修正（管理表は修正前）'] += 1; continue
    if i in wording and d == {'statement'}: diff_kind['同じIDで言い回しが違う'] += 1; continue
    if d == {'quality'} and qa['status'] == 'hidden' and qg['status'] == 'published' and qa['checks'] == qg['checks']:
        diff_kind['アプリでは非表示だが、管理表のタグに「非表示」が無い（元の管理表から）'] += 1; continue
    unexpected.append(f'{i}：{sorted(d)}')
res['content_compare'] = dict(diff_kind)
check('復旧版から作り直した問題が、アプリの問題と ID・内容で対応する（想定外の差なし）', not unexpected,
      f'{dict(diff_kind)}' + (f'／想定外 {unexpected[:5]}' if unexpected else ''))
rest_ok = sum(1 for i in restored if i in gen and all(app[i].get(k) == gen[i].get(k) for k in KEYS)
              and (app[i]['quality']['status'], app[i]['quality']['checks']) == (gen[i]['quality']['status'], gen[i]['quality']['checks']))
check('復元した 558問は、作り直すとアプリの内容と完全に同じ（入力用の答えを除く）', rest_ok == len(restored) == 558, f'{rest_ok}/{len(restored)}')
res['restored_exact'] = rest_ok
extra = set(gen) - set(app)
check('作り直すと増える問題＝新しい 254問', extra == newids, f'{len(extra)}')
res['grading_missing'] = diff_kind['入力用の答え（列が無い）']

json.dump(dict(result=res, failed=fails), open(HERE / 'restore_validation.json', 'w'), ensure_ascii=False, indent=1)
print('\n' + ('すべて合っています' if not fails else f'{len(fails)} 件合いません'))
sys.exit(1 if fails else 0)
