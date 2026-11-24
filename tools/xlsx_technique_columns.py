#!/usr/bin/env python3
"""管理表の解法の列を、content の指定（technique_main・technique_support）から新しい2列で書いた「別のファイル」を作る。

使い方：
    python3 tools/xlsx_technique_columns.py 元の管理表.xlsx 新しい管理表.xlsx [--allow ID,ID,…]

すること：
  1. 元のファイルは読むだけ（上書きしない。出力先が元と同じか、すでにあれば止める）。
  2. 「問題一覧」シートの旧「解法」列（v0.28.x の1列）があれば、その値と content の指定を照合する。
     旧列の値は「先頭が主、残りが補助」、「主な解法なし」は主なし（補助はタグから来ていたので照合しない）。
     合わない行があれば止める（--allow に書いた問題だけは、content の方が新しいものとして許す）。
  3. 旧「解法」列を消し、最後に「主な解法」「補助の解法」の2列を足して、content の指定を書く。
       明示の指定がある問題：主な解法＝名前か「主な解法なし」、補助の解法＝名前を読点区切りか「補助の解法なし」
       自動の問題：2列とも空欄
  4. content の明示の指定のうち、管理表に行が無いものがあれば止める（黙って落とさない）。
ほかのセル・シートは変えない（書いたあとで全セルを読み直して確かめる）。
"""
import copy
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_app_data import NO_MAIN, NO_SUPPORT  # noqa: E402

SHEET = '問題一覧'


def content_specs(content=ROOT / 'content'):
    out = {}
    for f in sorted((Path(content) / 'problems').glob('*.json')):
        for p in json.loads(f.read_text(encoding='utf-8')):
            if 'technique_main' in p or 'technique_support' in p:
                out[p['id']] = (p.get('technique_main'), p.get('technique_support') or [])
    return out


def cells(main, sup):
    return (NO_MAIN if main is None else main), ('、'.join(sup) if sup else NO_SUPPORT)


def legacy_of(main, sup):
    """旧「解法」列で同じ意味になる値（主なしの補助は旧形式ではタグ由来なので書かない）"""
    return [NO_MAIN] if main is None else [main, *sup]


def split(raw):
    return [t.strip() for t in re.split(r'[,、，]', str(raw or '')) if t.strip()]


def convert(src, dst, allow=(), content=ROOT / 'content'):
    src, dst = Path(src), Path(dst)
    if dst.exists() or dst.resolve() == src.resolve():
        raise SystemExit(f'出力先 {dst} がすでにあるか、元のファイルと同じです（上書きしません）')
    specs = content_specs(content)
    wb = openpyxl.load_workbook(src)
    ws = wb[SHEET]
    head = [str(c.value or '').strip() for c in ws[1]]
    while head and not head[-1]:
        head.pop()
    if '主な解法' in head or '補助の解法' in head:
        raise SystemExit('すでに「主な解法」「補助の解法」の列があります')
    legacy = head.index('解法') + 1 if '解法' in head else None
    idcol = head.index('ID') + 1
    rows, problems = {}, []
    for r in range(2, ws.max_row + 1):
        pid = ws.cell(r, idcol).value
        if not pid:
            continue
        pid = str(pid).strip()
        rows[pid] = r
        if legacy:
            old = split(ws.cell(r, legacy).value)
            new = legacy_of(*specs[pid]) if pid in specs else []
            if old != new and pid not in allow:
                problems.append(f'{pid}（{r}行目）：旧「解法」列 {old or "空欄"} ／ content {new or "未指定（自動）"}')
    missing = sorted(set(specs) - set(rows))
    if missing:
        problems.append(f'content の明示の指定のうち、管理表に行が無い問題：{missing}')
    if problems:
        raise SystemExit('照合で合わない行があります（何も書いていません）：\n  ' + '\n  '.join(problems))
    style = ws.cell(1, len(head))
    if legacy:
        ws.delete_cols(legacy)
        head.pop(legacy - 1)
    c_main, c_sup = len(head) + 1, len(head) + 2
    for c, title in ((c_main, '主な解法'), (c_sup, '補助の解法')):
        h = ws.cell(1, c, title)
        h.font, h.fill, h.alignment, h.border = (copy.copy(x) for x in (style.font, style.fill, style.alignment, style.border))
        ws.column_dimensions[openpyxl.utils.get_column_letter(c)].width = 36
    for pid, (main, sup) in specs.items():
        m, s = cells(main, sup)
        ws.cell(rows[pid], c_main, m)
        ws.cell(rows[pid], c_sup, s)
    wb.save(dst)
    return {'rows': len(rows), 'written': len(specs), 'legacy_removed': bool(legacy), 'columns': (c_main, c_sup)}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    allow = []
    if '--allow' in sys.argv:
        allow = [x for x in sys.argv[sys.argv.index('--allow') + 1].split(',') if x]
        args = [a for a in args if a != sys.argv[sys.argv.index('--allow') + 1]]
    if len(args) != 2:
        raise SystemExit(__doc__)
    r = convert(args[0], args[1], allow)
    print(f'{args[1]} を書きました：問題 {r["rows"]}行・明示の指定 {r["written"]}問・旧「解法」列 {"削除" if r["legacy_removed"] else "なし"}')


if __name__ == '__main__':
    main()
