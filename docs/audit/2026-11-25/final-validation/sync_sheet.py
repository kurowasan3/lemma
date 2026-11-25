#!/usr/bin/env python3
"""PR #3 で検証済みの修正を，管理表（xlsx）の該当セルだけに反映する。

    python3 sync_sheet.py 元.xlsx 新.xlsx <修正後の content/problems を含むリポジトリ>

方針（管理表の書式・コメント・フィルター・他のシートを壊さないため，openpyxl で保存し直さない）：
- xlsx（zip）の中の「問題一覧」シートの XML だけを書き換え，ほかの部品はバイト単位でそのまま写す。
- 書き換えるのは，対象の問題の行の「答え」「解答・解説」「核となるアイデア」セルのうち，
  修正後の content の値と今の値が違うセルだけ。セルの属性（書式番号 s など）は変えず，<t> の中身だけ差し替える。
- 文字の書き方は元の管理表と同じ（ASCII 以外は &#数字; 、<>& はエスケープ、改行はそのまま）。
  書き換える前に，今の値をこの書き方で書くと元の XML と完全に一致することを確かめる（一致しなければ中止）。
- 列は見出しの名前で探す（列の位置を決め打ちしない）。
"""
import json, re, sys, zipfile
from pathlib import Path

TARGETS = {'III-DIF-374': 'III-16', 'III-DIF-380': 'III-16', 'III-DIF-359': 'III-16', 'A-GEO-115': 'A-06',
           'C-CUR-459': 'C-19', 'C-CUR-484': 'C-19', 'II-GEO-300': 'II-09', 'B-SEQ-342': 'B-13', 'II-CAL-312': 'II-12'}
FIELDS = {'答え': lambda p: p['answer']['tex'], '解答・解説': lambda p: p['solutions'][0]['tex'],
          '核となるアイデア': lambda p: (p.get('idea') or {}).get('tex', '')}
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def enc(s):
    out = []
    for ch in s:
        if ch == '&': out.append('&amp;')
        elif ch == '<': out.append('&lt;')
        elif ch == '>': out.append('&gt;')
        elif ord(ch) > 127: out.append(f'&#{ord(ch)};')
        else: out.append(ch)
    return ''.join(out)

def dec(x):
    x = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), x)
    x = re.sub(r'&#x([0-9a-fA-F]+);', lambda m: chr(int(m.group(1), 16)), x)
    return x.replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&apos;', "'").replace('&amp;', '&')

def col_letter(n):
    s = ''
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s

def sheet_path(z, name):
    wb = z.read('xl/workbook.xml').decode('utf-8')
    rid = re.search(r'<sheet [^>]*name="' + re.escape(name) + r'"[^>]*r:id="([^"]+)"', wb).group(1)
    rels = z.read('xl/_rels/workbook.xml.rels').decode('utf-8')
    tgt = re.search(r'<Relationship [^>]*Id="' + rid + r'"[^>]*Target="([^"]+)"', rels) or re.search(r'<Relationship [^>]*Target="([^"]+)"[^>]*Id="' + rid + '"', rels)
    t = tgt.group(1)
    return t.lstrip('/') if t.startswith('/') else 'xl/' + t

def cell_re(ref):
    return re.compile(r'<c r="' + ref + r'"((?:\s+[a-zA-Z:]+="[^"]*")*)\s*(?:/>|>(.*?)</c>)', re.S)

def main(src, dst, repo):
    repo = Path(repo)
    new = {}
    for pid, f in TARGETS.items():
        d = json.loads((repo / f'content/problems/{f}.json').read_text(encoding='utf-8'))
        d = d if isinstance(d, list) else d['problems']
        new[pid] = next(p for p in d if p['id'] == pid)
    zin = zipfile.ZipFile(src)
    sp = sheet_path(zin, '問題一覧')
    xml = zin.read(sp).decode('utf-8')
    # 見出し行
    head = {}
    for m in re.finditer(r'<c r="([A-Z]+)1"[^>]*?>(?:<is><t[^>]*>(.*?)</t></is>|<v>(.*?)</v>)</c>', xml.split('</row>', 1)[0] + '</row>', re.S):
        head[dec(m.group(2) or m.group(3) or '')] = m.group(1)
    cols = {k: head[k] for k in FIELDS}
    idcol = head['ID']
    # ID → 行番号
    rows = {}
    for m in re.finditer(r'<c r="' + idcol + r'(\d+)"[^>]*t="inlineStr"[^>]*><is><t[^>]*>([^<]*)</t></is></c>', xml):
        v = dec(m.group(2))
        if v in TARGETS: rows.setdefault(v, []).append(int(m.group(1)))
    log, edits = [], []
    for pid in TARGETS:
        assert len(rows.get(pid, [])) == 1, f'{pid} の行が1つでない：{rows.get(pid)}'
        r = rows[pid][0]
        for fname, getter in FIELDS.items():
            ref = f'{cols[fname]}{r}'
            m = cell_re(ref).search(xml)
            assert m, f'{ref} が見つからない'
            attrs, inner = m.group(1), m.group(2) or ''
            tm = re.fullmatch(r'<is><t( [^>]*)?>(.*)</t></is>', inner, re.S) if inner else None
            cur = dec(tm.group(2)) if tm else ''
            if tm:
                assert enc(cur) == tm.group(2), f'{ref}：元の XML の書き方を再現できない（中止）'
            want = getter(new[pid])
            if cur == want:
                log.append((pid, fname, ref, '変更なし')); continue
            assert tm and 't="inlineStr"' in attrs, f'{ref}：inlineStr でないセル（想定外，中止）'
            tattr = tm.group(1) or ''
            if want != want.strip() and 'xml:space' not in tattr: tattr += ' xml:space="preserve"'
            repl = f'<c r="{ref}"{attrs}><is><t{tattr}>{enc(want)}</t></is></c>'
            edits.append((m.start(), m.end(), repl)); log.append((pid, fname, ref, '更新'))
    for s, e, rp in sorted(edits, reverse=True):
        xml = xml[:s] + rp + xml[e:]
    with zipfile.ZipFile(dst, 'w') as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == sp: data = xml.encode('utf-8')
            zout.writestr(info, data, compress_type=info.compress_type)
    for l in log: print(' | '.join(map(str, l)))
    print(f'更新したセル {sum(1 for l in log if l[3]=="更新")}，シート {sp}')

if __name__ == '__main__':
    main(*sys.argv[1:4])
