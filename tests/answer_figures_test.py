#!/usr/bin/env python3
"""管理表の「答えの図」列の読み取り（tools/xlsx_to_content.py の parse_answer_figures）の単体テスト"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tools'))
import xlsx_to_content as X

passed = failed = 0
def ok(c, m):
    global passed, failed
    if c: passed += 1
    else: failed += 1; print('  FAIL ' + m)

P = X.parse_answer_figures

ok(P(None) is None and P('') is None and P('  \n ') is None, '空のセルは図なし')

r = P('y<x^2, x>0')
ok(r == [{'mode': '2d', 'exprs': ['y<x^2, x>0']}], '式だけなら平面の図が1つ')

r = P('見出し：(2) 領域 D\nモード：平面\n範囲：x -3..3, y -1.5..4\n縦横比：自由\n説明：境界を含む\ny<=x\n(1,1)\n---\nモード：複素数平面\n|z-1|=1')
ok(len(r) == 2, '「---」で図を2つに分ける')
ok(r[0] == {'mode': '2d', 'exprs': ['y<=x', '(1,1)'], 'title': '(2) 領域 D', 'view': [-3, 3, -1.5, 4], 'free_aspect': True, 'note': '境界を含む'},
   '見出し・範囲・縦横比・説明を読む（整数の範囲は整数のまま）')
ok(r[1] == {'mode': 'complex', 'exprs': ['|z-1|=1']}, '2つ目の図のモードと式')

r = P('縦横比：自由\ny=x')
ok('free_aspect' not in r[0], '範囲がないときは縦横比：自由を付けない')

for bad, why in [('範囲：x 3..-3, y 0..1\ny=x', '範囲の左右が逆'), ('モード：立体\ny=x', '知らないモード')]:
    try:
        P(bad); ok(False, why + 'は取り込みを止める')
    except X.ImportFailure:
        ok(True, why)

print(f'答えの図の読み取り：{passed} 件合格' + (f'，{failed} 件失敗' if failed else ''))
sys.exit(1 if failed else 0)
