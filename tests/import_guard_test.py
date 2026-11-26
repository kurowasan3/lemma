#!/usr/bin/env python3
"""取り込みの安全装置（tools/import_xlsx.py の compare_problems）の単体テスト：古い管理表で項目が消えるのを見つける"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tools'))
import import_xlsx as I

passed = failed = 0
def ok(c, m):
    global passed, failed
    if c: passed += 1
    else: failed += 1; print('  FAIL ' + m)

old = {
    'A': {'id': 'A', 'statement': 's', 'answer_figures': [{'mode': '2d', 'exprs': ['y=x']}], 'memo': ''},
    'B': {'id': 'B', 'statement': 't', 'solutions': [{'text': '新しい解説'}]},
    'C': {'id': 'C', 'statement': 'u'},
}
new = {
    'A': {'id': 'A', 'statement': 's'},                                # 答えの図の列が無い古い管理表
    'B': {'id': 'B', 'statement': 't', 'solutions': [{'text': '古い解説'}]},  # 直した解説が戻る
    'D': {'id': 'D', 'statement': 'v'},                                # 新しい問題
}
gone, lost, changed = I.compare_problems(old, new)
ok(gone == ['C'], '管理表に無い問題を見つける')
ok(lost == [('A', ['answer_figures'])], '空になる項目を見つける（もともと空の項目は数えない）')
ok(changed == ['A', 'B'], '内容が変わる問題を数える（新しい問題 D は含めない）')
ok(I.compare_problems(old, old) == ([], [], []), '同じなら何も無い')

print(f'取り込みの安全装置：{passed} 件合格' + (f'，{failed} 件失敗' if failed else ''))
sys.exit(1 if failed else 0)
