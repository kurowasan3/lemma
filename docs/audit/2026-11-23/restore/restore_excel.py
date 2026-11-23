#!/usr/bin/env python3
"""管理表の復旧版を作る（元の管理表は読むだけ。content/ も読むだけ）。

    python3 restore_excel.py 元の管理表.xlsx 出力.xlsx

- ID：idmap/excel_rename_plan.csv の「合わせた後のID」に、行番号で置き換える（A 列のセルだけ）。
- 復元：idmap/excel_restore_plan.csv の 558問を、content/ の内容から末尾に行として足す（既存の行・書式・入力規則・数式はそのまま）。
- 条件付き書式（ID の重複を赤くする）の数える範囲 $A$2:$A$5000 を $A$2:$A$10000 にする（復元後の 5,471行を含めるため）。
- Excel は XML を直接書き換える（openpyxl で保存すると入力規則の拡張などが落ちるため）。
ログ（このフォルダ）：id_rename_log.csv・new_id_assignment.csv・restore_558_log.csv
"""
import csv
import hashlib
import json
import math
import re
import sys
import zipfile
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
HERE = Path(__file__).resolve().parent
IDMAP = HERE.parent / 'idmap'
REPO = HERE.parents[3]
CONTENT = REPO / 'content'
assert SRC.resolve() != OUT.resolve(), '元の管理表には書かない'
SHEET, SST = 'xl/worksheets/sheet2.xml', 'xl/sharedStrings.xml'

src_hash = hashlib.sha256(SRC.read_bytes()).hexdigest()
zin = zipfile.ZipFile(SRC)
names = [i.filename for i in zin.infolist()]
assert SHEET in names and SST in names
wb = zin.read('xl/workbook.xml').decode()
rels = zin.read('xl/_rels/workbook.xml.rels').decode()
rid = re.search(r'<sheet name="問題一覧"[^>]*r:id="(rId\d+)"', wb).group(1)
assert f'Id="{rid}"' in rels and re.search(rf'Id="{rid}"[^>]*Target="worksheets/sheet2.xml"', rels), '問題一覧が sheet2.xml でない'
sheet = zin.read(SHEET).decode()
sst = zin.read(SST).decode()

# ---------------------------------------------------------------- 共有文字列
def unesc(s):
    s = re.sub(r'_x([0-9A-Fa-f]{4})_', lambda m: chr(int(m.group(1), 16)), s)
    s = re.sub(r'&#x([0-9A-Fa-f]+);', lambda m: chr(int(m.group(1), 16)), s)
    s = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), s)
    return s.replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&apos;', "'").replace('&amp;', '&')

strings = [unesc(''.join(re.findall(r'<t[^>]*>(.*?)</t>', x, re.S))) for x in re.findall(r'<si>(.*?)</si>', sst, re.S)]
new_si = []
def sidx(text):
    new_si.append(text)
    return len(strings) + len(new_si) - 1

def xml_text(s):
    s = escape(s)
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', lambda m: f'_x{ord(m.group(0)):04X}_', s)

# ---------------------------------------------------------------- 行と A 列
def row_xml(n):
    m = re.search(rf'<row r="{n}"[ >].*?</row>', sheet, re.S)
    return m

last_row = max(int(x) for x in re.findall(r'<row r="(\d+)"', sheet))
id_at = {}
for m in re.finditer(r'<c r="A(\d+)"([^>]*)><v>(\d+)</v></c>', sheet):
    if 't="s"' in m.group(2) and int(m.group(1)) >= 2:          # 1行目は見出し
        id_at[int(m.group(1))] = strings[int(m.group(3))].strip()

plan = list(csv.DictReader(open(IDMAP / 'excel_rename_plan.csv', encoding='utf-8-sig')))
assert len(plan) == len(id_at) and all(id_at.get(int(p['管理表の行'])) == p['今のID'] for p in plan), '対応表と管理表の行・ID が合わない'
rename_log, new_log = [], []
for p in plan:
    n, before, after = int(p['管理表の行']), p['今のID'], p['合わせた後のID']
    if p['分類'] == '新規':
        new_log.append([n, before, after, '変更' if before != after else 'そのまま', p['根拠']])
    if before == after:
        continue
    pat = re.compile(rf'<c r="A{n}"([^>]*)><v>\d+</v></c>')
    m = pat.search(sheet)
    assert m and 't="s"' in m.group(1)
    sheet = sheet[:m.start()] + f'<c r="A{n}"{m.group(1)}><v>{sidx(after)}</v></c>' + sheet[m.end():]
    rename_log.append([n, before, after, p['分類'], p['根拠']])

# ---------------------------------------------------------------- 復元する行
tax = json.loads((CONTENT / 'taxonomy.json').read_text())
fmeta = {f['key']: f for f in tax['fields']}
app = {}
for f in (CONTENT / 'problems').glob('*.json'):
    if f.name != 'builtin.json':
        for x in json.loads(f.read_text()):
            app[x['id']] = x
restore = list(csv.DictReader(open(IDMAP / 'excel_restore_plan.csv', encoding='utf-8-sig')))
tmpl = row_xml(last_row).group(0)
style = dict(re.findall(r'<c r="([A-S])\d+" s="(\d+)"', tmpl))
EPOCH = date(1899, 12, 30)

def sc(col, n, text):        # 文字列のセル
    return f'<c r="{col}{n}" s="{style[col]}" t="s"><v>{sidx(text)}</v></c>' if text != '' else f'<c r="{col}{n}" s="{style[col]}"/>'

def nc(col, n, v):           # 数のセル
    return f'<c r="{col}{n}" s="{style[col]}" t="n"><v>{v}</v></c>'

rows_new, restore_log = [], []
n = last_row
for r in restore:
    aid = r['アプリのID（戻す行のID）']
    x = app[aid]
    n += 1
    fm = fmeta[x['field']]
    q = x['quality']; ch = q['checks']
    sol = x['solutions']
    assert len(sol) == 1 and sol[0]['id'] == 'main'
    created = (x.get('provenance') or {}).get('created')
    tags = list(x.get('tags') or [])
    if q.get('status') == 'hidden':
        tags.append('非表示')
    yes = lambda b: '済' if b else '未'
    verified = '✓' if all(ch.values()) else '未'
    texts = [x['statement']['tex'], x['answer']['tex'], sol[0]['tex'], (x.get('idea') or {}).get('tex', '')]
    lines = max(sum(max(1, math.ceil(len(l) / 45)) for l in t.split('\n')) for t in texts)
    ht = min(409.5, max(30.0, 15.0 * lines))
    memo = f'v0.27.4 で content/ から復元（{r["区分"]}）。参考元・作成方法は content/ に無いため空欄'
    cells = [
        sc('A', n, aid),
        nc('B', n, (date.fromisoformat(created) - EPOCH).days) if created else sc('B', n, ''),
        sc('C', n, fm['subject']), sc('D', n, fm['name']), sc('E', n, x.get('theme') or ''),
        nc('F', n, int(x['level'])), nc('G', n, int(x['minutes'])) if x.get('minutes') else sc('G', n, ''),
        sc('H', n, x['statement']['tex']), sc('I', n, x['answer']['tex']), sc('J', n, sol[0]['tex']),
        sc('K', n, (x.get('idea') or {}).get('tex', '')),
        sc('L', n, ''), sc('M', n, ''),
        sc('N', n, yes(ch['dual'])), sc('O', n, yes(ch['sympy'])), sc('P', n, yes(ch['human'])),
        f'<c r="Q{n}" s="{style["Q"]}" t="str"><f aca="false">IF(A{n}=&quot;&quot;,&quot;&quot;,IF(AND(N{n}=&quot;済&quot;,O{n}=&quot;済&quot;,P{n}=&quot;済&quot;),&quot;✓&quot;,&quot;未&quot;))</f><v>{verified}</v></c>',
        sc('R', n, ','.join(tags)), sc('S', n, memo),
    ]
    rows_new.append(f'<row r="{n}" customFormat="false" ht="{ht}" hidden="false" customHeight="true" outlineLevel="0" collapsed="false">' + ''.join(cells) + '</row>')
    h = hashlib.sha1('\n'.join(texts).encode()).hexdigest()[:12]
    restore_log.append([n, aid, x['field'], fm['subject'], fm['name'], x['level'], created, r['区分'], r['管理表の近い行'], r['その行のアプリID'], r['問題文の類似'], h,
                        'content/problems/' + x['field'] + '.json'])

end = sheet.index('</sheetData>')
sheet = sheet[:end] + ''.join(rows_new) + sheet[end:]
new_last = n
sheet = re.sub(r'<dimension ref="A1:S\d+"/>', f'<dimension ref="A1:S{new_last}"/>', sheet, count=1)
cf_old = 'COUNTIF($A$2:$A$5000,A3)'
assert sheet.count(cf_old) == 1
sheet = sheet.replace(cf_old, 'COUNTIF($A$2:$A$10000,A3)')
for sq in re.findall(r'sqref="[A-Z]+2:[A-Z]+(\d+)"', sheet):
    assert int(sq) >= new_last, '入力規則の範囲が足りない'

# ---------------------------------------------------------------- 共有文字列を足して書き出す
add = ''.join(f'<si><t xml:space="preserve">{xml_text(s)}</t></si>' for s in new_si)
cnt = int(re.search(r'<sst [^>]*count="(\d+)"', sst).group(1))
refs_new = len(new_si)            # 足した文字列はどれも1回ずつ参照（置き換えた A 列は元の参照が1つ減って新しい参照が1つ増える）
renamed = len(rename_log)
sst = sst.replace('</sst>', add + '</sst>')
sst = re.sub(r'count="\d+"', f'count="{cnt + refs_new - renamed}"', sst, count=1)
sst = re.sub(r'uniqueCount="\d+"', f'uniqueCount="{len(strings) + len(new_si)}"', sst, count=1)
OUT.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(OUT, 'w') as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        if info.filename == SHEET: data = sheet.encode('utf-8')
        elif info.filename == SST: data = sst.encode('utf-8')
        zout.writestr(info, data, compress_type=info.compress_type)
assert hashlib.sha256(SRC.read_bytes()).hexdigest() == src_hash, '元の管理表が変わった'

def W(name, head, rows):
    with open(HERE / name, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(head); w.writerows(rows)
W('id_rename_log.csv', ['管理表の行', '変更前のID', '変更後のID', '分類', '根拠'], rename_log)
W('new_id_assignment.csv', ['管理表の行', '今のID', '割り当てたID', 'ID', '根拠'], new_log)
W('restore_558_log.csv', ['復旧版の行', 'アプリのID', '分野ID', '科目', '分野', '難易度', '作成日', '区分', '管理表の近い行', 'その行のアプリID', '問題文の類似',
                          '内容の照合用の値（問題文・答え・解説・アイデアの sha1 先頭12桁）', '復元元'], restore_log)
print(json.dumps(dict(source_sha256=src_hash, rows_before=last_row - 1, renamed=renamed, new_rows=len(rows_new), rows_after=new_last - 1,
                      new_ids_changed=sum(r[3] == '変更' for r in new_log), new_ids_kept=sum(r[3] == 'そのまま' for r in new_log),
                      shared_strings_added=len(new_si)), ensure_ascii=False))
