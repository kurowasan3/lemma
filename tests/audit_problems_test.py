#!/usr/bin/env python3
"""tools/audit_problems.py の単体テスト：人の記入の検証・優先順・類似の扱い（データは読まない）"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tools'))
import audit_problems as A

passed = failed = 0
def ok(c, m):
    global passed, failed
    if c: passed += 1
    else: failed += 1; print('  FAIL ' + m)

def prob(pid, level=2, human=False, ans='1', sol='解説', idea='要点', tex=None, sympy=True):
    return {'id': pid, 'field': 'I-01', 'level': level, 'theme': pid, 'statement': {'tex': tex or f'{pid} の問題文。$x^2+1$ の値を求めよ。'},
            'answer': {'tex': ans}, 'solutions': [{'tex': sol}] if sol else [], 'idea': {'tex': idea},
            'quality': {'status': 'published', 'checks': {'sympy': sympy, 'human': human}}}

P = [prob('P1'), prob('P2'), prob('P3'), prob('P4', human=True), prob('P5')]
byid = {p['id']: p for p in P}
def row(pid, vals, h=None, **kw):
    r = {'問題ID': pid, A.HASH_COL: A.content_hash(byid[pid]) if h is None and pid in byid else (h or '')}
    r.update({c: v for c, v in zip(A.HCOLS, vals)}); r.update(kw); return r
ALL_OK = ['OK'] * 9

# ---- 人の記入の検証
res = A.check_reviewed([row('P1', ALL_OK)], byid)
ok(res['done'] == ['P1'] and not res['warnings'] and not res['errors'], '9項目すべて OK → 済にしてよい')
res = A.check_reviewed([row('P1', ['OK'] * 8 + ['要修正']), row('P2', ['×'] + ['OK'] * 8)], byid)
ok([x[0] for x in res['fix']] == ['P1', 'P2'] and not res['done'], '要修正・× が1つでもあれば直す問題')
res = A.check_reviewed([row('P1', ['OK'] * 8 + [''])], byid)
ok(res['partial'] == ['P1'] and not res['done'], '一部が空欄 → 確認途中')
res = A.check_reviewed([row('P1', ['OK'] * 8 + ['ok']), row('P2', ['OK'] * 8 + ['○']), row('P3', ['OK'] * 8 + ['済'])], byid)
ok(not res['done'] and len(res['warnings']) == 3, '「ok」「○」「済」など決まった値以外は警告し、確認済みにしない')
res = A.check_reviewed([row('ZZ-999', ALL_OK, h='x')], byid)
ok(res['errors'] and not res['done'], '存在しない問題 ID は誤り')
res = A.check_reviewed([row('P1', ALL_OK), row('P1', ALL_OK)], byid)
ok(not res['done'] and any('2 行' in w for w in res['warnings']), '同じ問題 ID が複数行 → 警告し確認済みにしない')
res = A.check_reviewed([row('P1', ALL_OK, h='000000000000')], byid)
ok(not res['done'] and any('照合用' in w for w in res['warnings']), '内容が変わった（古い CSV）→ 警告し確認済みにしない')
res = A.check_reviewed([row('P1', ALL_OK, h='')], byid)
ok(not res['done'], '照合用の値が空（以前の形式の CSV）→ 確認済みにしない')
res = A.check_reviewed([row('P4', ALL_OK)], byid)
ok(not res['done'] and not res['errors'], 'すでに「済」の問題は、済にする一覧に重ねて出さない')
res = A.check_reviewed([row('P1', [''] * 9)], byid)
ok(not res['done'] and not res['partial'] and not res['fix'], '何も記入していない行は無視')
res = A.check_reviewed([{'問題ID': 'P1', A.HASH_COL: A.content_hash(byid['P1']), A.HCOLS[0]: 'OK'}], byid)
ok(res['errors'] and not res['done'], '【人】の列が足りない CSV は誤り')

# ---- 優先順：1問1行・理由はすべて・人の確認済みは優先2〜4から外す・頻出度と難易度の順
Q = [prob('A', level=0, sol=''), prob('B', level=3, sol='', idea=''), prob('C', level=1, idea=''), prob('D', level=2, human=True, sol=''),
     prob('E', level=4), prob('F', level=0, sympy=False)]
qb = {p['id']: p for p in Q}
value = {'A': 1, 'B': 3, 'C': 3, 'F': 2}
pri = A.priority(Q, [], [], [], value, {})
ok(set(pri) == {'A', 'B', 'C', 'E', 'F'}, f'人の確認済み（D）は優先2〜4に出さない（{sorted(pri)}）')
ok(pri['B'][0] == 2 and len(pri['B'][1]) == 3 and len(set(pri['B'][1])) == 3, '複数の理由は1行にまとめ、重複させない（B：解説・アイデア・主な解法）')
order = A.priority_order(pri, qb, value)
ok(order[:3] == ['C', 'B', 'A'], f'同じ優先度では頻出度の高い順・難易度の低い順（{order}）')
pri2 = A.priority(Q[:1] + [prob('G'), prob('H')], [], [['G', 'H']], [], {}, {})
ok(pri2['G'][0] == 1 and '消す対象とは限らない' in pri2['G'][1][0], '数値だけ違う問題は確認の候補で、消す対象とは書かない')
sim = [('A', 'E', 0.95, 0.9, True), ('C', 'F', 0.93, 0.5, False)]
pri3 = A.priority(Q, [], [], sim, {}, {})
ok(pri3['C'][0] == 1 and pri3['F'][0] == 1 and pri3['A'][0] == 2, '類似度 0.9 以上でも短い問題文の組は優先1にしない')

# ---- 類似：短い問題文の印
ps = [prob('S1', tex='$a_1=1$, $a_{n+1}=2a_n-3^n$ で定まる数列の一般項を求めよ。'), prob('S2', tex='$a_1=2$, $a_{n+1}=3a_n+2n$ で定まる数列の一般項を求めよ。')]
sp = A.similar_pairs(ps, thr=0.5)
ok(sp and sp[0][4] is True, f'短い問題文の組に「短い」の印（{sp}）')
print(f'audit_problems_test: {passed} 件 OK' + (f'、{failed} 件失敗' if failed else ''))
sys.exit(1 if failed else 0)
