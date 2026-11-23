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
# ---- v0.22：CSV の読み込み（列の欠け・列の順番・BOM・空行と崩れた行・誤りと警告）
import csv, tempfile, os, json
def write_csv(rows, head, bom=True):
    fd, path = tempfile.mkstemp(suffix='.csv'); os.close(fd)
    with open(path, 'w', newline='', encoding='utf-8-sig' if bom else 'utf-8') as f:
        w = csv.writer(f); w.writerow(head); w.writerows(rows)
    return path
HEAD = ['問題ID', '分野', A.HASH_COL] + A.HCOLS
good = ['P1', 'I-01', A.content_hash(byid['P1'])] + ['OK'] * 9
rows, errs = A.read_reviewed(write_csv([good], HEAD))
ok(not errs and A.check_reviewed(rows, byid)['done'] == ['P1'], 'BOM つき UTF-8 の CSV を読める')
rows, errs = A.read_reviewed(write_csv([good], HEAD, bom=False))
ok(not errs and A.check_reviewed(rows, byid)['done'] == ['P1'], 'BOM なしでも読める')
perm = list(reversed(HEAD)); rows, errs = A.read_reviewed(write_csv([list(reversed(good))], perm))
ok(not errs and A.check_reviewed(rows, byid)['done'] == ['P1'], '列の順番が変わっても正しく読む')
rows, errs = A.read_reviewed(write_csv([['P1', 'I-01', ''] + [''] * 8], HEAD[:-1]))
ok(errs and '必要な列が無い' in errs[0] and not rows, '必要な列の欠けは、記入が空かどうかより先に誤りにする')
rows, errs = A.read_reviewed(write_csv([good, [''] * len(HEAD), ['', '', ''] + [''] * 9, ['P2', 'I-01']], HEAD))
ok(len(rows) == 1 and len(errs) == 1 and '列の数' in errs[0], f'空行は飛ばし、列の数が合わない行は誤りにする（{errs}）')
res = A.check_reviewed([{**dict(zip(HEAD, good)), '_line': 2}, {**dict(zip(HEAD, ['P2', 'I-01', A.content_hash(byid['P2'])] + ['OK'] * 8 + ['良い'])), '_line': 3}], byid)
ok(res['done'] == ['P1'] and res['warnings'] and not res['errors'], '使えない値は警告（誤りとは分ける）で、確認済みにしない')
res = A.check_reviewed([{**dict(zip(HEAD, ['ZZ'] + good[1:])), '_line': 2}], byid)
ok(res['errors'] and not res['warnings'], '存在しない ID は誤り（警告とは分ける）')
res = A.check_reviewed([{'問題ID': 'P1', A.HCOLS[0]: 'OK'}], byid)
ok(res['errors'] and '必要な列' in res['errors'][0], 'check_reviewed に直接渡しても、列の欠けを先に誤りにする')

# ---- 自動検証と人の確認を分ける
pa = prob('Q1'); h = A.content_hash(pa)
auto = {'Q1': {'h': h, 'at': 'x', 'items': [{'i': '', 'kind': '定積分', 'result': 'pass-symbolic', 'detail': ''}], 'lint': []}}
ok(A.quality_status(pa, auto, {}) == ('pass', 'none'), '自動検証に合格しても、人の確認は「未実施」のまま')
ok(A.quality_status(pa, {'Q1': {**auto['Q1'], 'h': 'old'}}, {}) == ('stale', 'none'), '内容が変わったら自動検証の記録は「古い」（合格とみなさない）')
ok(A.quality_status(pa, {}, {})[0] == 'none', '自動検証を実行していない問題は「未実行」')
ok(A.quality_status(pa, {'Q1': {'h': h, 'at': 'x'}}, {})[0] == 'na', '対象外の記録は「対象外」（合格にしない）')
fail_rec = {'Q1': {'h': h, 'at': 'x', 'items': [{'i': '', 'kind': '極限', 'result': 'fail', 'detail': ''}], 'lint': []}}
ok(A.quality_status(pa, fail_rec, {})[0] == 'issue', '自動検証で不一致なら「不一致あり」')
ok(A.quality_status(pa, {}, {'Q1': {'h': h, 'result': 'fix'}})[1] == 'fix', '人の確認で要修正')
ok(A.quality_status(pa, {}, {'Q1': {'h': 'old', 'result': 'done'}})[1] == 'stale', '人の確認のあとで内容が変わったら「古い」（完了とみなさない）')
ok(A.quality_status(prob('Q2', human=True), {}, {})[1] == 'declared', '管理表の「済」は、内容の照合ができない「管理表で済」として区別')
fd, hp = tempfile.mkstemp(suffix='.json'); os.close(fd); os.remove(hp)
n = A.record_human({'done': ['P1'], 'fix': [('P2', ['解答の正確性'])], 'items': {'P1': {}, 'P2': {}}}, byid, path=Path(hp), today='2026-11-23')
rec = json.loads(Path(hp).read_text(encoding='utf-8'))['results']
ok(n == 2 and rec['P1']['result'] == 'done' and rec['P2']['result'] == 'fix' and rec['P1']['h'] == A.content_hash(byid['P1']) and rec['P1']['at'] == '2026-11-23' and rec['P1']['method'],
   '人の確認の記録に、問題 ID・結果・日付・方法・照合用の値を残す')
pri4 = A.priority([pa], [], [], [], {}, {}, {'Q1': ('issue', 'none', ['答えの無い小問 (2)'])})
ok(pri4['Q1'][0] == 1 and any('自動検証' in x for x in pri4['Q1'][1]) and any('構造の候補' in x for x in pri4['Q1'][1]), '自動検証の不一致は優先1、構造の候補も理由に並べる')

# ---- 学習上の役割の近い問題：同じ解法でもアイデアが違えば出さない・言い回しが違ってもアイデアが同じなら候補
def rp(pid, idea, theme, tex=None):
    q = prob(pid, level=3, tex=tex); q['idea'] = {'tex': idea}; q['theme'] = theme; return q
R1 = rp('R1', '不動点を引いて等比数列に直す．', '2項間漸化式', tex='$a_1=1$，$a_{n+1}=2a_n+1$ の一般項を求めよ．')
R2 = rp('R2', '不動点を引いて等比数列に直す．', '漸化式の一般項', tex=r'数列 $\{b_n\}$ は $b_1=3$，$b_{n+1}=\frac12 b_n+5$ をみたす．$b_n$ を求めよ．')
R3 = rp('R3', '両辺を $3^{n+1}$ で割って階差数列にする．', '指数を含む漸化式', tex='$a_1=1$，$a_{n+1}=3a_n+2^n$ の一般項を求めよ．')
mo = {'R1': 'recurrence', 'R2': 'recurrence', 'R3': 'recurrence'}
pairs = A.role_pairs([R1, R2, R3], mo, {})
got = {(x['a'], x['b']) for x in pairs}
ok(('R1', 'R2') in got, '文章が違っても、同じ解法・難易度・要求で核となるアイデアが同じ問題は「役割が近い候補」')
ok(('R1', 'R3') not in got and ('R2', 'R3') not in got, '同じ解法でも、アイデア（着眼点）が違う類題は候補にしない')
sim_text = A.similar_pairs([R1, R2], thr=0.7)
ok(not sim_text, '役割が近い組は、文字列の類似では見つからない（だから別に比べる）')

# ---- v0.27：答えが同じで問題文の数字も近い組（言いかえた同じ問題）
D1 = prob('D1', tex='円に内接する四角形 ABCD で，半径 7，BC=CD=7，周の長さ 38 のとき AB，DA を求めよ．', ans=r'$\mathrm{AB}=11$，$\mathrm{DA}=13$')
D2 = prob('D2', tex='半径 7 の円に内接する四角形 ABCD がある．辺 BC と CD はともに 7，周は 38 である．残りの2辺の長さを求めよ．', ans=r'AB$=11$，DA$=13$')
D3 = prob('D3', tex='半径 5 の円に内接する四角形で，周 30 のとき AB と DA を求めよ．', ans=r'$\mathrm{AB}=11$，$\mathrm{DA}=13$')
D4 = prob('D4', tex='命題 1 を示せ．', ans='(1) 証明　(2) 証明')
D5 = prob('D5', tex='命題 1 を示せ．', ans='(1) 証明　(2) 証明')
sa = A.same_answer_pairs([D1, D2, D3, D4, D5])
ok([(a, b) for a, b, _ in sa] == [('D1', 'D2')], f'書き方の違う同じ答え＋数字の重なり → 候補（数字の違う D3、答えが「証明」だけの D4・D5 は出さない）（{sa}）')
ok(not A.similar_pairs([D1, D2], thr=0.7), '（文字列の類似では見つからない組）')
pri = A.priority([D1, D2], [], [], [], {}, {}, same_ans=sa)
ok(pri['D1'][0] == 1 and '答えが同じ' in pri['D1'][1][0], '答えが同じ組は優先1（重複と決めるのは人）')

print(f'audit_problems_test: {passed} 件 OK' + (f'、{failed} 件失敗' if failed else ''))
sys.exit(1 if failed else 0)
