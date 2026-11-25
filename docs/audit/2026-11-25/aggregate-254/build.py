#!/usr/bin/env python3
"""254問の独立解答監査（監査A 161問・監査B 93問）の統合と小問単位集計。

リポジトリのルートで `python3 docs/audit/2026-11-25/aggregate-254/build.py` と実行する。
読むだけのファイル:
  docs/audit/2026-11-25/dual/{results.csv,report.md,independent_answers.md}        （監査A）
  docs/audit/2026-11-25/dual-rest/{results.csv,report.md,blind_answers.md}         （監査B）
  content/problems/*.json の statement / answer（小問の骨格と保存済み答案の取得のみ）
書き出すファイル（このディレクトリ内のみ）:
  problem_summary.csv, subproblem_summary.csv, aggregate_report.md
既存のファイルは一切書き換えない。
"""
import csv, glob, json, os, re, sys
from collections import Counter, OrderedDict

ROOT = os.getcwd()
OUT = os.path.join(ROOT, 'docs/audit/2026-11-25/aggregate-254')
DA = 'docs/audit/2026-11-25/dual/'
DB = 'docs/audit/2026-11-25/dual-rest/'
SRC_A, SRC_B = '161問（監査A）', '93問（監査B）'
VALID = {'A', 'B', 'C', 'D'}
UNDET = '判定不能'

def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()
def rcsv(p): return list(csv.reader(open(os.path.join(ROOT, p), encoding='utf-8')))

# ---------------------------------------------------------------- 1. 読み込みと整合性確認
RA, RB = rcsv(DA + 'results.csv'), rcsv(DB + 'results.csv')
issues = []
rowsA, rowsB = RA[1:], RB[1:]
for name, rows in (('監査A', rowsA), ('監査B', rowsB)):
    for r in rows:
        if len(r) != 5: issues.append(f'{name} {r[:1]}: 列数が5でない（{len(r)}列）')
idsA, idsB = [r[0] for r in rowsA], [r[0] for r in rowsB]
checks = OrderedDict()
checks['監査Aの行数=161'] = len(idsA) == 161
checks['監査Bの行数=93'] = len(idsB) == 93
checks['統合対象=254'] = len(idsA) + len(idsB) == 254
checks['監査A内でID一意'] = len(set(idsA)) == len(idsA)
checks['監査B内でID一意'] = len(set(idsB)) == len(idsB)
checks['監査間でID重複なし'] = not (set(idsA) & set(idsB))
checks['254件すべて一意'] = len(set(idsA + idsB)) == 254
checks['分類がすべてA〜Dのいずれか1つ'] = all(r[2] in VALID for r in rowsA + rowsB)
for r in rowsA + rowsB:
    if r[2] not in VALID: issues.append(f'{r[0]}: 分類「{r[2]}」は無効')
idsB_json = json.loads(rd(DB + 'ids.json'))
checks['監査Bの行がids.jsonの93問と一致'] = sorted(idsB_json) == sorted(idsB)

def report_counts(path):
    c = {}
    for m in re.finditer(r'^\|\s*(?:\*\*)?([ABCD])(?:\*\*)?[^|]*\|\s*(\d+)\s*\|\s*$', rd(path), re.M):
        c[m.group(1)] = int(m.group(2))
    return c
cntA, cntB = Counter(r[2] for r in rowsA), Counter(r[2] for r in rowsB)
repA, repB = report_counts(DA + 'report.md'), report_counts(DB + 'report.md')
checks['監査A: CSVの件数=報告書の件数'] = all(repA.get(k, 0) == cntA.get(k, 0) for k in 'ABCD')
checks['監査B: CSVの件数=報告書の件数'] = all(repB.get(k, 0) == cntB.get(k, 0) for k in 'ABCD')
EXPECTED = {'A': (137, 70), 'B': (20, 13), 'C': (4, 9), 'D': (0, 1)}
checks['問題単位の集計が期待値と一致'] = all((cntA.get(k, 0), cntB.get(k, 0)) == v for k, v in EXPECTED.items())

# 監査Aの「解き方」列の記録上の異常（修正はしない）
for r in rowsA:
    if r[3].strip() in ('a',) or len(r[3].strip()) <= 1:
        issues.append(f'{r[0]}（監査A）: 「解き方」列が「{r[3]}」で方法を読み取れない。小問単位では方法不明として扱った（既存記録は変更していない）')

for r in rowsA:
    if r[2] == 'A' and re.search(r'n<=|m=5|<80|130未満|探索|LP', r[3]):
        issues.append(f'{r[0]}（監査A）: 問題単位はAだが「解き方」が「{r[3]}」で範囲を限った探索・あいまいな探索の注記がある。分類は変更せず，小問単位では方法を帰属できないものを判定不能とした')
# ---------------------------------------------------------------- 2. 問題データ（読むだけ）
ALL = set(idsA + idsB)
recs = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'content/problems/*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    for x in (d if isinstance(d, list) else d.get('problems', [d])):
        if isinstance(x, dict) and x.get('id') in ALL: recs[x['id']] = x
checks['254問すべての問題データが見つかる'] = len(recs) == 254

def statement_tex(i):
    s = recs[i]['statement']; return s['tex'] if isinstance(s, dict) else s
def n_statement_subs(i):
    env, top = [], 0
    for line in statement_tex(i).splitlines():
        s = line.strip()
        m = re.match(r'\\begin\{(enumerate|itemize)\}(\[.*\])?', s)
        if m: env.append((m.group(1), bool(m.group(2)))); continue
        if re.match(r'\\end\{(enumerate|itemize)\}', s): env.pop(); continue
        if s.startswith(r'\item') and len(env) == 1 and env[0] == ('enumerate', False): top += 1
    return top
def split_num(text):
    p = re.split(r'(?:^|(?<=[\s　]))\((\d+)\)\s*', text.strip())
    return p[0].strip(), OrderedDict((int(p[j]), p[j + 1].strip()) for j in range(1, len(p), 2))
def stored_subs(i):
    head, segs = split_num(recs[i]['answer']['tex'])
    return segs if segs else OrderedDict({0: head})
for i in sorted(ALL):
    n, st = n_statement_subs(i), stored_subs(i)
    keys = list(st.keys())
    if not ((n == 0 and keys == [0]) or keys == list(range(1, n + 1))):
        issues.append(f'{i}: 問題文の小問数 {n} と保存済み答案の区切り {keys} が一致しない')
checks['問題文の小問数と保存済み答案の区切りが全問一致'] = not any('区切り' in x for x in issues)

# 独立解答
indA, cur = {}, None
for line in rd(DA + 'independent_answers.md').splitlines():
    if line.startswith('## '): cur = line[3:].strip(); indA[cur] = ''; continue
    if cur: indA[cur] += line + ' '
def indA_subs(i):
    t = indA.get(i, '').strip()
    m = re.search(r'\s*\[([^\]]*)\]\s*$', t); note = m.group(1) if m else ''
    if m: t = t[:m.start()]
    head, segs = split_num(t)
    if not segs and head: segs = OrderedDict({0: head})
    return segs, note
indB, cur = {}, None
for line in rd(DB + 'blind_answers.md').splitlines():
    if line.startswith('## '): cur = line[3:].strip(); indB[cur] = []; continue
    if cur: indB[cur].append(line)
def indB_subs(i):
    segs, k, body = OrderedDict(), None, []
    for line in indB.get(i, []):
        m = re.match(r'^(\d+)\.\s+(.*)', line)
        if m: k = int(m.group(1)); segs[k] = m.group(2); continue
        if line.strip() and not line.startswith('---'):
            if k is not None: segs[k] += ' ' + line.strip()
            else: body.append(line.strip())
    return segs if segs else OrderedDict({0: ' '.join(body)})
checks['監査Aの161問すべてに独立解答の見出しがある'] = all(i in indA for i in idsA)
checks['監査Bの93問すべてに独立解答の見出しがある'] = all(i in indB for i in idsB)

PROOF_RE = re.compile(r'^証明(（[^）]*）)?[。．]?$')
# 機械判定の例外（理由はレポートに記載）
FORCE_ANSWER = {('III-DIF-389', 1): '保存済み答案は「証明（…極大・極小…）」の形だが，問題が極大・極小の別を答えさせており実質的な答えを含むため，答えのある小問として扱った'}
FORCE_PROOF = {('III-INT-715', 3): '存在を示す小問。保存済み答案は具体例を挙げるが独立解答は「証明」のみで具体例を示していないため，証明小問として扱った',
               ('II-CAL-306', 1): '保存済み答案は「証明」のみ。監査Aの独立解答は等号成立条件を書いているが，照合する保存済みの値がないため証明小問として扱った'}
def is_proof_sub(i, k, stored):
    if (i, k) in FORCE_ANSWER: return False
    if (i, k) in FORCE_PROOF: return True
    return bool(PROOF_RE.match(stored.strip()))

# ---------------------------------------------------------------- 3. 小問単位の分類規則
# 監査A：方法は問題単位の「解き方」列のみ。小問への帰属は「メモ」列に明記されたものだけを使う。
A_ANALYTIC = {'手計算', 'SymPy', '手計算+SymPy', '総当たり', '手計算+総当たり', '手計算+列挙',
              '総当たり、整数要素のみが辺を持つことは手で確認'}
A_ATTR = {  # メモ列の記述から小問を特定できるもの
    'A-INT-461': {3: 'B'}, 'B-SEQ-337': {2: 'B', 3: 'B'}, 'B-SEQ-338': {3: 'B'}, 'B-SEQ-342': {1: 'C'},
    'C-CUR-458': {2: 'B'}, 'C-CUR-459': {3: 'B'}, 'C-CUR-465': {2: 'B'}, 'C-VEC-458': {3: 'B'},
    'I-QF-150': {1: 'C'}, 'II-CAL-309': {2: 'B'}, 'II-TRI-187': {2: 'B'}, 'II-TRI-191': {3: 'B'},
    'III-DIF-352': {3: 'B'}, 'III-DIF-355': {2: 'B'}, 'III-DIF-369': {2: 'B'}, 'III-DIF-372': {2: 'C'},
    'III-DIF-378': {0: 'B'}, 'III-DIF-396': {0: 'B'}, 'III-DIF-366': {2: 'C'}, 'III-DIF-367': {2: 'B'},
    'III-DIF-376': {1: 'B'}, 'III-INT-718': {2: 'B'}, 'X-MIX-081': {2: 'B', 3: 'B'}, 'B-SEQ-324': {3: 'B'},
}
A_HUMAN = {('III-DIF-356', 2): '監査Aの「解き方」列に「後ろ2つ(3重根の場合)は要人確認」とある'}

# 監査B：blind_answers_methods.md の表（保存済み答案を開く前に記録）と results.csv のメモから。
# 表にない答えのある小問は，methods.md の明記どおり「手計算・確信度 高」。
B_SUB = {}
def bset(i, ks, cat, method, conf='高', note=''):
    for k in ks: B_SUB[(i, k)] = (cat, method, conf, note)
bset('II-LOG-095', [3], 'A', '手計算'); bset('X-MIX-091', [3], 'A', '手計算'); bset('A-COM-497', [3], 'A', '手計算')
bset('A-COM-500', [3, 4], 'B', '範囲を限った探索（n≤8 全順列）＋一般式の当てはめ', '高', '一般式は解析的に導いていない')
bset('A-COM-501', [3], 'A', '手計算')
bset('A-COM-511', [1, 2], 'B', '範囲を限った探索（n≤7 全写像）＋多項式当てはめ', '中', '一般式は解析的に導いていない')
bset('A-COM-513', [2], 'A', '手計算（鏡像法）＋総当たり（n≤6）で検算')
bset('A-COM-513', [3], 'C', '手計算（鏡像法）＋総当たり（n≤6）で検算', '高', '表記の違い：C(2n,n+⌈r/2⌉) と偶奇別の表記')
bset('A-GEO-114', [2], 'B', '数値計算→有理数・√3として認識', '高', '厳密な導出はしていない')
bset('A-INT-454', [1, 2, 3], 'A', '総当たり（全ケース：操作を厳密に実行）')
bset('A-INT-457', [3], 'A', '手計算')
bset('B-SEQ-295', [1, 2], 'A', 'SymPy（厳密）＋手計算')
bset('B-SEQ-308', [2], 'B', '範囲を限った探索（a₂≤200000）', '中', '族の形は探索からの推定。上限外の例外がないことは未証明')
bset('B-SEQ-311', [3], 'B', '範囲を限った探索（添字≤40）＋手計算で一般形を確認', '中', '一致する添字の型が{m,m+1,m+3}だけであることは探索による')
bset('B-SEQ-325', [1, 2], 'A', '手計算＋有理数格子での厳密な検算')
bset('B-SEQ-331', [2, 3], 'B', '総当たり（a₃は3通り）＋一般項は初めの項からの推定を漸化式で確認', '高',
     '問題単位はAと記録されているが，methods.md の記録では一般項を初めの項から推定しているため，小問単位の原則（数値サンプルからの式の同定）に従いBとした。問題単位の分類は変更していない')
bset('B-SEQ-332', [1, 2], 'A', '手計算＋数値で境界を検算'); bset('B-SEQ-339', [2], 'A', '手計算')
bset('C-CUR-460', [2], 'A', 'SymPy＋手計算'); bset('C-CUR-462', [2], 'A', '手計算', '中', '除外値 FA=9/8 の扱いに確信度中と記録')
bset('C-CUR-466', [3], 'A', '手計算'); bset('C-CUR-467', [1, 2, 3], 'A', '手計算＋数値で検算')
bset('C-CUR-469', [4], 'C', '手計算', '高', '保存済みの「2頂点を除く」は y≠0 に含まれ同じ集合')
bset('C-CUR-471', [2, 3], 'A', '手計算')
bset('C-CUR-473', [1], 'C', '手計算', '高', '方程式が −1 倍の違い'); bset('C-CUR-473', [2], 'A', '手計算')
bset('C-CUR-474', [1, 2, 3], 'A', '手計算')
bset('C-CUR-476', [2], 'B', 'SymPy で数組の値を代入して q/4 と推定', '高', '一般の記号計算はしていない')
bset('C-CUR-479', [2], 'C', '手計算', '高', '4/tanθ と 4cosθ/sinθ')
bset('C-CUR-482', [1, 2], 'A', 'SymPy（厳密）')
bset('C-CUR-484', [1, 2], 'B', 'SymPy で λ の数値4つ→式に当てはめ', '高', '一般の記号計算はしていない')
bset('C-CUR-486', [1, 2], 'A', '手計算（極線）＋SymPy で最大化')
bset('C-CUR-489', [2, 3], 'A', '手計算')
bset('C-VEC-452', [2], 'A', '手計算', '中', '区間内のすべての値の実現を細かく確認していないと記録')
bset('C-VEC-454', [2, 3], 'A', '手計算（固有値）'); bset('C-VEC-455', [1, 2], 'A', '手計算')
bset('C-VEC-456', [2], 'B', '数値計算（最適化）＋手計算で平面')
bset('C-VEC-459', [2], 'A', '手計算＋数値で検算')
bset('II-CAL-313', [3], 'B', '数値計算（線形計画）＋手計算で構成', '中', '±1 を両方含まない区間の上界は解析的に示していない')
bset('II-GEO-300', [2], 'A', '手計算'); bset('II-GEO-302', [2], 'A', '手計算'); bset('II-TRI-188', [3], 'A', '手計算')
bset('II-TRI-190', [1], 'B', '数値計算（根の数え上げ）＋手計算', '高', 'methods.md は (1)(2)(3) をまとめて「数値計算＋手計算」と記録しており，(1) を解析的に導いたことを確認できないためBとした')
bset('II-TRI-190', [2, 3], 'D', '数値計算（根の数え上げ）＋手計算', '高',
     '境界 a=±1/√2 で不一致。照合後の再計算ではブラインド解答側の誤りと判断されたが，人による確認は未完了。Dを維持')
bset('II-TRI-192', [1, 2, 3], 'A', '手計算'); bset('III-DIF-350', [2], 'A', '手計算（展開）')
bset('III-DIF-357', [1, 3], 'A', '手計算')
bset('III-DIF-364', [2], 'B', '数値計算（mpmath で臨界点を分類）＋手計算で最小値')
bset('III-DIF-368', [2, 3], 'A', '手計算'); bset('III-DIF-377', [2, 3], 'A', '手計算')
bset('III-DIF-379', [0], 'A', '手計算（展開）')
bset('III-DIF-380', [1], 'A', '手計算')
bset('III-DIF-380', [2], 'C', '手計算', '高', '解が2個という前提のもとで「ab<e かつ max(a,b)>1」と「ab<e」は同値')
bset('III-DIF-387', [2], 'A', '手計算'); bset('III-DIF-389', [1, 2], 'A', '手計算'); bset('III-DIF-393', [0], 'A', '手計算')
bset('III-DIF-395', [2], 'A', '手計算（数値は初めの見当のみ）')
bset('III-INT-721', [3, 4], 'A', '手計算'); bset('III-INT-723', [2, 3], 'A', '手計算')
bset('III-LIM-314', [3], 'B', '数値計算（交点の数え上げ）')
bset('X-MIX-086', [2], 'A', '手計算')
bset('A-COM-493', [1], 'A', '手計算＋プログラムで検算')
bset('A-COM-493', [3], 'B', '範囲を限った探索（m≤5）', '中', '一般式は解析的に導いていない')
bset('A-COM-495', [2], 'A', '総当たり（全ケース：8の分割すべて）', '高',
     '最終答案（6状態）は一致。ただし独立解答に付随する説明「周期6の1つの巡回」は誤りで，正しくは周期4と周期2の2つの巡回（保存済みの記述が正しい）。最終答案の一致と説明の正しさは別')
bset('A-INT-455', [2], 'B', '範囲を限った探索（k≤7，要素の絶対値に上限）', '中')
bset('B-SEQ-326', [3], 'A', '手計算'); bset('II-EQ-267', [2], 'A', '手計算')
bset('X-MIX-090', [3], 'C', '手計算', '高', '例が異なる（どちらも条件をみたす）')
bset('X-MIX-085', [3], 'C', '手計算', '高', '例が異なる（どちらも条件をみたす）')
bset('A-COM-509', [1], 'C', '手計算', '高', 'p−q=2p−1 等による表記の違い')
bset('III-LIM-312', [4], 'C', '手計算', '高', '1/√2 と √2/2')
B_HUMAN = {('II-TRI-190', 2), ('II-TRI-190', 3)}

def clip(s, n=160):
    s = re.sub(r'\s+', ' ', s).strip()
    return s if len(s) <= n else s[:n - 1] + '…'

sub_rows, unresolved_reasons = [], Counter()
lvl = {r[0]: r[1] for r in rowsA + rowsB}
probcat = {r[0]: r[2] for r in rowsA + rowsB}
for r in rowsA:
    i, level, cat, method, memo = r
    st = stored_subs(i); ia, inote = indA_subs(i)
    answered = [k for k, s in st.items() if not is_proof_sub(i, k, s)]
    for k, s in st.items():
        sp = '全体' if k == 0 else f'({k})'
        ind = ia.get(k, '')
        human = 'はい' if (i, k) in A_HUMAN else 'いいえ'
        note = []
        if (i, k) in FORCE_ANSWER: note.append(FORCE_ANSWER[(i, k)])
        if (i, k) in FORCE_PROOF: note.append(FORCE_PROOF[(i, k)])
        if (i, k) in A_HUMAN: note.append(A_HUMAN[(i, k)])
        if is_proof_sub(i, k, s):
            c, pc = UNDET, '未確認（監査Aは「証明」の小問を照合対象外と明記）'
            note.insert(0, '照合対象外（証明小問）'); unresolved_reasons['証明小問（主張・論証とも照合対象外：監査A）'] += 1
            m_used = ''
        else:
            pc = '最終答案のみ照合。証明部分は未確認' if '証明' in s else '該当なし'
            m_used = method
            if not ind:
                c = UNDET; note.insert(0, '照合不能：独立解答の記録なし'); unresolved_reasons['独立解答の記録なし（監査A）'] += 1
            elif k in A_ATTR.get(i, {}):
                c = A_ATTR[i][k]; note.insert(0, f'一致（{"同値・表記差" if c == "C" else "保存済み答案と一致"}）。メモ列「{memo}」により小問を特定')
            elif method.strip() in A_ANALYTIC:
                c = 'A'; note.insert(0, '一致。問題単位の「解き方」が単一の解析的方法（' + method + '）のため，この小問の方法として扱った')
                if '総当たり' in method or '列挙' in method:
                    note.append('総当たりの全ケース性は監査Aの報告書の記述（全ケースを調べ尽くしたものをAとした）による。本統合では再確認していない')
            elif len(answered) == 1 and cat in ('A', 'B') and not re.search(r'n<=|m=5|<80|130未満|探索|LP|^a$', method):
                c = cat; note.insert(0, f'一致。答えのある小問がこの1つだけなので，問題単位の判定（{cat}，解き方「{method}」）はこの小問についての判定と同一')
            else:
                c = UNDET
                why = '「解き方」列の記録が読み取れず' if method.strip() == 'a' else ('方法に範囲を限った探索・あいまいな探索の注記があり' if re.search(r'n<=|m=5|<80|130未満|探索|LP', method) else '方法に数値計算が含まれ')
                note.insert(0, f'一致（問題単位）。ただし{why}，どの小問に使ったかの記録がないため，小問単位の検証強度を確定できない（解き方「{method}」）')
                unresolved_reasons['方法が小問に帰属できない（監査A）'] += 1
        sub_rows.append([i, sp, SRC_A, clip(ind) if ind else '', clip(s), c, m_used, '', pc, ' '.join(note), human])
for r in rowsB:
    i, level, cat, method, memo = r
    st = stored_subs(i); ib = indB_subs(i)
    for k, s in st.items():
        sp = '全体' if k == 0 else f'({k})'
        ind = ib.get(k, '')
        human = 'はい' if (i, k) in B_HUMAN else 'いいえ'
        note = []
        if (i, k) in FORCE_ANSWER: note.append(FORCE_ANSWER[(i, k)])
        if (i, k) in FORCE_PROOF: note.append(FORCE_PROOF[(i, k)])
        if is_proof_sub(i, k, s):
            c, m_used, conf = UNDET, '手計算', '高'
            pc = '主張の真偽のみ確認（要点のみ記載）。保存済み解説の論証は未検証'
            note.insert(0, '証明小問：主張の真偽は一致。論証の妥当性は未検証のため判定不能に区分')
            unresolved_reasons['証明小問（主張の真偽のみ確認・論証未検証：監査B）'] += 1
        else:
            pc = '値のみ照合。証明部分は主張の真偽のみ確認、解説の論証は未検証' if '証明' in s else '該当なし'
            if (i, k) in B_SUB:
                c, m_used, conf, extra = B_SUB[(i, k)]
            else:
                c, m_used, conf, extra = 'A', '手計算', '高', 'methods.md の既定（表にない小問は手計算・確信度 高）による'
            if not ind:
                c = UNDET; extra = '照合不能：独立解答の記録なし'; unresolved_reasons['独立解答の記録なし（監査B）'] += 1
            status = {'A': '一致', 'B': '一致', 'C': '同値（表記差）', 'D': '不一致'}.get(c, '')
            note.insert(0, (status + '。' if status else '') + extra)
        sub_rows.append([i, sp, SRC_B, clip(ind), clip(s), c, m_used, conf, pc, ' '.join(x for x in note if x), human])

# ---------------------------------------------------------------- 4. 問題単位の表
prob_rows = []
sub_by_id = {}
for row in sub_rows: sub_by_id.setdefault(row[0], []).append(row)
for src, rows in ((SRC_A, rowsA), (SRC_B, rowsB)):
    for i, level, cat, method, memo in rows:
        sc = Counter(x[5] for x in sub_by_id[i])
        notes = []
        if memo: notes.append(memo)
        notes.append('小問内訳 ' + ' '.join(f'{k}:{sc[k]}' for k in ['A', 'B', 'C', 'D', UNDET] if sc[k]))
        if i == 'II-TRI-190': notes.append('D は (2)(3)。境界 a=±1/√2。保存済み答案が正しいと考えられているが人による確認は未完了')
        if i == 'A-COM-495': notes.append('最終答案は一致（A）。独立解答の説明「周期6の1つの巡回」は誤り（正しくは周期4と周期2）')
        if method.strip() == 'a': notes.append('「解き方」列が「a」で方法を読み取れない（記録上の異常）')
        human = 'はい' if (cat == 'D' or any(x[10] == 'はい' for x in sub_by_id[i])) else 'いいえ'
        prob_rows.append([i, src, level, cat, method, ' / '.join(notes), human])

# ---------------------------------------------------------------- 5. 検証（自己テスト）
pc = Counter(r[3] for r in prob_rows)
checks['problem_summary が254行'] = len(prob_rows) == 254
checks['problem_summary のID一意'] = len({r[0] for r in prob_rows}) == 254
checks['問題単位A〜Dが元CSVと一致'] = all(pc[k] == cntA[k] + cntB[k] for k in 'ABCD')
checks['小問単位の行数=骨格の小問数'] = len(sub_rows) == sum(len(stored_subs(i)) for i in ALL)
checks['II-TRI-190 が問題単位Dで残っている'] = probcat['II-TRI-190'] == 'D'
checks['II-TRI-190 の小問にDがあり人手確認=はい'] = any(r[0] == 'II-TRI-190' and r[5] == 'D' and r[10] == 'はい' for r in sub_rows)
checks['A-COM-495 の説明上の誤りが記録されている'] = any(r[0] == 'A-COM-495' and '周期6' in r[9] for r in sub_rows)
checks['問題単位Bの問題に小問Aだけしかない例がない'] = all(any(x[5] in ('B', UNDET) for x in sub_by_id[i]) for i in ALL if probcat[i] == 'B')
checks['問題単位Cの問題に小問Cがある'] = all(any(x[5] == 'C' for x in sub_by_id[i]) for i in ALL if probcat[i] == 'C')
checks['小問Dは問題単位Dの問題にだけある'] = all(probcat[r[0]] == 'D' for r in sub_rows if r[5] == 'D')

# ---------------------------------------------------------------- 6. 書き出し
def wcsv(name, header, rows):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f); w.writerow(header); w.writerows(rows)
wcsv('problem_summary.csv', ['id', 'source_audit', 'level', 'category', 'method_summary', 'notes', 'human_review_required'], prob_rows)
wcsv('subproblem_summary.csv', ['id', 'subproblem', 'source_audit', 'independent_answer', 'stored_answer', 'category',
                               'method', 'confidence', 'proof_checked', 'notes', 'human_review_required'], sub_rows)

sc_all = Counter(r[5] for r in sub_rows)
sc_src = {s: Counter(r[5] for r in sub_rows if r[2] == s) for s in (SRC_A, SRC_B)}
N = len(sub_rows); U = sc_all[UNDET]; DEN = N - U
def pct(a, b): return f'{100 * a / b:.1f}%' if b else '—'
proofU = sum(v for k, v in unresolved_reasons.items() if k.startswith('証明'))
stats = dict(N=N, U=U, DEN=DEN)

L = []
def P(s=''): L.append(s)
P('# 254問 独立解答監査の統合・小問単位集計（2026-11-25）')
P()
P('> このファイルは `build.py` が生成した。数値はすべてスクリプトの集計結果であり，手で数えた数字は載せていない。')
P('> これは AI による確認の統合であり，人による確認ではない。')
P()
P('## 1. 監査の目的と範囲')
P()
P('v0.29.2 で追加した254問について，既存の2つの独立解答監査（監査A 161問・監査B 93問）の記録を統合し，問題単位と小問単位の両方で「何がどの強さで独立に検証され，何が未検証か」を追跡できるようにする。')
P('今回の作業は記録の統合と分析のみで，問題データ・保存済みの答え・解説・品質評価・既存の監査ファイルは変更していない。既存の分類（問題単位）も変更していない。')
P()
P('## 2. 2つの監査の実施条件')
P()
P('| | 監査A | 監査B |')
P('|---|---|---|')
P('| 対象 | 入力用の答えを付けた161問 | 入力用の答えがない93問 |')
P('| 記録 | `docs/audit/2026-11-25/dual/`（main） | `docs/audit/2026-11-25/dual-rest/`（ブランチ `audit/2026-11-25-dual-rest-blind`） |')
P('| 解いた環境 | 同一セッション内で問題文だけを表示して解き，その後に保存済みの答えを表示 | リポジトリ外の空ディレクトリで `problems.md` の1ファイルだけを使用 |')
P('| 独立解答の記録範囲 | 証明以外の小問の最終答案のみ（証明小問は記録・照合なし） | 全小問（証明小問は「証明」と要点） |')
P('| 方法の記録 | 問題単位の「解き方」列（小問への帰属はメモ列の一部のみ） | 小問単位の表（`blind_answers_methods.md`，答えを開く前に記録） |')
P('| 確信度 | 記録なし | 小問単位で記録 |')
P()
P('## 3. ブラインド検証の独立性に関する記録')
P()
P('- 監査A：報告書によれば，独立解答 `independent_answers.md` を書いた後に保存済みの答えを表示し，照合前に書き換えていない。同じセッション内での作業であり，コミット順序による独立性の裏付けはない（独立解答・報告書・照合結果は同じコミット `d6eb058`（16:27:27）で追加）。A〜D の分類は後のコミット `c3193af`（17:06:50）で `results.csv`・`report.md` に付与された。`independent_answers.md` は `d6eb058` 以降変更されていない（git で確認）。また同セッションで93問の保存済み答えを表示してしまったため，その93問は監査Bとして別セッションで解き直された。')
P('- 監査B：コミット順序で確認できる。')
P('  - `c2796457cb8fc765f14c1c090716290cc9442ee2`（18:53:49）`blind_answers.md` のみ追加（解答確定）')
P('  - `f62760b7ff9a0f5ab028c438a1bb406f12c316b8`（18:54:52）`blind_answers_methods.md` のみ追加（方法・確信度。保存済み答案を開く前）')
P('  - `3c7be2680eac189085e2968f6a915eabadef5a42`（19:01:42）`results.csv`・`report.md` のみ追加（照合結果）')
P('  - 解答確定より後に照合結果が追加されており，`blind_answers.md` は確定後に変更されていない。ただし「確定前に保存済み答案を見ていない」こと自体は作業者（AI）の申告であり，コミットからは証明できない。')
P()
P('## 4. 問題単位の A〜D 集計')
P()
P('| 分類 | 161問（A） | 93問（B） | 合計 | 割合 |')
P('|---|---:|---:|---:|---:|')
for k in 'ABCD': P(f'| {k} | {cntA[k]} | {cntB[k]} | {cntA[k] + cntB[k]} | {pct(cntA[k] + cntB[k], 254)} |')
P(f'| 合計 | {len(rowsA)} | {len(rowsB)} | {len(rowsA) + len(rowsB)} | 100.0% |')
P()
P(f'- 問題単位の一致率（A+B+C）：{cntA["A"] + cntB["A"] + cntA["B"] + cntB["B"] + cntA["C"] + cntB["C"]}/254 = {pct(254 - cntA["D"] - cntB["D"], 254)}')
P('- 期待値（A 137/70，B 20/13，C 4/9，D 0/1）と実際のCSVの集計は' + ('一致した。' if checks['問題単位の集計が期待値と一致'] else '**一致しなかった**。'))
P('- A と B は統合していない。問題単位の A は「最終答案の一致」についての分類で，証明小問の論証や解説の正しさは含まない。')
P()
P('## 5. 小問単位の A〜D 集計')
P()
P('### 小問の数え方')
P()
P('- 小問は問題文の最上位の `enumerate` の `\\item`。保存済み答案の「(k)」区切りと全254問で一致することを確認した。小問のない2問（III-DIF-379，III-DIF-393）は「全体」で1小問と数えた。')
P('- III-LIM-314 の条件 (i)〜(iii) は小問ではないので数えていない。')
P()
P('### 分類の規則')
P()
P('- **問題単位の分類を小問に写していない。** 小問の分類は，その小問について方法が確認できる記録だけから決めた。')
P('- 監査A：')
P('  - 証明小問は監査Aが照合対象外と明記しているので「判定不能」。')
P('  - メモ列で小問が特定されているもの（例「(2) 端点…」）はその分類。')
P('  - 問題単位の「解き方」が単一の解析的方法（手計算，SymPy，手計算+SymPy，総当たり，手計算+総当たり，手計算+列挙）の問題では，その方法をすべての小問の方法として扱い A。総当たりの全ケース性は監査Aの報告書の記述によるもので，本統合では再確認していない。')
P('  - 方法に数値計算や範囲を限った探索が含まれ，どの小問に使ったかの記録がない場合は「判定不能」。ただし，答えのある小問が1つだけの問題では問題単位の判定がその小問の判定と同一なので，その分類とした（範囲限定・あいまいな探索の注記があるものは除く）。')
P('- 監査B：`blind_answers_methods.md`（保存済み答案を開く前に記録）の小問単位の方法と，`results.csv` のメモに従った。表にない答えのある小問は，同ファイルの明記どおり「手計算・確信度 高」。')
P('  - 数値計算で答えを決めたもの，範囲を限った探索，数値サンプルからの式の同定は B。数値を検算に使っただけで結論を手で導いたものは A。')
P('  - 証明小問は主張の真偽は確認しているが論証は未検証なので「判定不能」（A には入れない）。')
P('- 個別の扱い：')
for (i, k), v in list(FORCE_ANSWER.items()) + list(FORCE_PROOF.items()): P(f'  - {i} ({k})：{v}')
P()
P('- 問題単位と小問単位で強さが異なる例（問題単位の分類は変更していない）：')
P('  - B-SEQ-331：問題単位 A。methods.md の記録では一般項を初めの項から推定して漸化式で確かめているため，(2)(3) は小問単位 B。')
P('  - II-TRI-190 (1)：methods.md が (1)〜(3) をまとめて「数値計算＋手計算」と記録しており，(1) を解析的に導いたと確認できないため B。')
P()
P('### 集計')
P()
P('| 分類 | 161問（A） | 93問（B） | 合計 | 全小問に対する割合 |')
P('|---|---:|---:|---:|---:|')
for k in ['A', 'B', 'C', 'D', UNDET]:
    P(f'| {k} | {sc_src[SRC_A][k]} | {sc_src[SRC_B][k]} | {sc_all[k]} | {pct(sc_all[k], N)} |')
P(f'| 合計 | {sum(sc_src[SRC_A].values())} | {sum(sc_src[SRC_B].values())} | {N} | 100.0% |')
P()
P('## 6. 解析的検証率')
P()
P(f'- **解析的検証率（小問単位）＝ A の小問数 ÷ 判定可能な小問数 ＝ {sc_all["A"]} ÷ {DEN} ＝ {pct(sc_all["A"], DEN)}**')
P(f'  - 判定可能な小問数 {DEN} ＝ 全小問 {N} − 判定不能 {U}')
P(f'  - 参考：全小問を分母にすると {sc_all["A"]} ÷ {N} ＝ {pct(sc_all["A"], N)}')
P(f'- 判定可能な小問に対する割合：B {pct(sc_all["B"], DEN)}，C {pct(sc_all["C"], DEN)}，D {pct(sc_all["D"], DEN)}')
P(f'- 判定不能率：{U} ÷ {N} ＝ {pct(U, N)}')
P(f'- 問題単位の A 率（{cntA["A"] + cntB["A"]}/254 ＝ {pct(cntA["A"] + cntB["A"], 254)}）とは別の数値であり，混同しないこと。問題単位の A は証明小問を含まない最終答案の照合結果である。')
P()
P('## 7. 数値計算・有界探索に依存した小問の割合')
P()
P(f'- B の小問：{sc_all["B"]}（監査A {sc_src[SRC_A]["B"]}，監査B {sc_src[SRC_B]["B"]}）')
P(f'- 判定可能な小問に対する数値計算依存率：{sc_all["B"]} ÷ {DEN} ＝ {pct(sc_all["B"], DEN)}')
num_undet = unresolved_reasons['方法が小問に帰属できない（監査A）']
P(f'- このほか，方法に数値計算・有界探索が含まれるがどの小問に使ったか記録のない小問が {num_undet} あり，判定不能に入れている。これらの一部は実際には数値依存の可能性があるため，上の依存率は下限とみるべきである。')
P()
P('## 8. 判定不能の件数と理由')
P()
P('| 理由 | 小問数 |')
P('|---|---:|')
for k, v in sorted(unresolved_reasons.items(), key=lambda x: -x[1]): P(f'| {k} | {v} |')
P(f'| 合計 | {sum(unresolved_reasons.values())} |')
P()
P(f'- 判定不能 {U} のうち {proofU} は証明小問で，最終答案の一致の対象ではなく，論証の検証が行われていないことを示す。')
P()
P('## 9. II-TRI-190 の人手確認事項')
P()
P('- 問題単位 **D**（維持）。小問単位：(1) B，(2) D，(3) D。')
P('- 不一致の内容：$a=\\pm\\frac1{\\sqrt2}$ の場合の解の個数 $N(a,n)$ と，(3) の組 $(a,n)$。')
P('  - 保存済み答案：$a=\\frac1{\\sqrt2}$ で $n$ 偶数 $\\frac{3n}2$・奇数 $\\frac{3n-1}2$，$a=-\\frac1{\\sqrt2}$ で偶数 $\\frac{3n}2$・奇数 $\\frac{3n+1}2$。(3) に「$a=\\pm\\frac1{\\sqrt2}$ かつ $n=1350$」を含む。')
P('  - 監査Bの独立解答：境界を $0<|a|<\\frac1{\\sqrt2}$ 側の式に含め，(3) に $a=\\frac1{\\sqrt2},\\ n=1013$ を含めた。')
P('- 監査Bの照合後の再計算では，独立解答側が重解を数値誤差で2個と数えた誤りと判断され，保存済み答案が正しいと考えられている。**ただし人による確認は完了していない。** AI の再計算を理由に D を A や C に変更していない。')
P('- 人に確認してほしい点：$a=\\pm\\frac1{\\sqrt2}$ のとき $\\sin\\left(x+\\frac\\pi4\\right)=\\mp1$ の解が1周期に1個であること，それによる個数の式，(3) の $n=1350$。')
P()
P('## 10. A-COM-495 の説明上の誤り')
P()
P('- 問題単位・小問 (2) ともに A（変更していない）。最終答案である6つの状態の集合は保存済み答案と一致した。')
P('- ただし独立解答（`blind_answers.md`）に付随する説明「この6状態で1つの周期6の巡回をなす」は誤りで，正しくは周期4（$(4,3,1)\\to(3,3,2)\\to(3,2,2,1)\\to(4,2,1,1)$）と周期2（$(4,2,2)\\leftrightarrow(3,3,1,1)$）の2つの巡回である（保存済みの記述が正しい）。')
P('- 最終答案の一致は，付随する説明の正しさを意味しない。この誤りは確定版に残っている（確定版は修正しない方針）。')
P()
P('## 11. 証明・解説の論証を検証していない範囲')
P()
proof_subs = [r for r in sub_rows if r[9].startswith('照合対象外（証明小問）') or r[9].startswith('証明小問')]
mixed = [r for r in sub_rows if r[8].startswith('最終答案のみ照合') or r[8].startswith('値のみ照合')]
P(f'- 証明小問：{len(proof_subs)}（監査A {sum(1 for r in proof_subs if r[2] == SRC_A)}：主張・論証とも照合対象外，監査B {sum(1 for r in proof_subs if r[2] == SRC_B)}：主張の真偽のみ確認）。')
P(f'- 値と証明を両方含む小問：{len(mixed)}。値は照合したが，証明部分の論証は検証していない。')
P(f'- 証明だけからなる問題（全小問が証明）：{sum(1 for i in ALL if all(x[8].startswith(("未確認", "主張の真偽")) for x in sub_by_id[i]))} 問。')
P('- 保存済み解説（`solutions`）の論証の正しさは，どちらの監査でも検証していない。最終答案の一致は解説の証明が正しいことを意味しない。')
P()
P('## 12. 今回の監査で確認できたこと')
P()
P('- 2つの results.csv は合わせて254問・ID重複なし・分類はすべて A〜D の1つで，各報告書の件数と一致する。')
P('- 問題単位：254問中 D は1問（II-TRI-190）のみ。それ以外の253問は最終答案が一致（または同値）。')
P(f'- 小問単位：判定可能な {DEN} 小問のうち {sc_all["A"]} が解析的導出により一致（{pct(sc_all["A"], DEN)}）。')
P('- 監査Bはコミット順序により「解答確定 → 方法の補遺 → 照合」の順で記録されている。')
P()
P('## 13. 今回の監査では確認できていないこと')
P()
P('- 証明小問の主張（監査A）と論証（両監査）。解説の正しさ。')
P(f'- 判定不能 {U} 小問の検証強度（特に監査Aで方法の帰属が記録されていない {num_undet} 小問）。')
P('- B 小問の一般の $n$・境界・例外点での成立（数値・有限範囲でしか確認していない）。')
P('- 監査Aの独立性（同一セッション内の作業で，コミットによる時系列の裏付けがない）。')
P('- 総当たりを A とした小問の全ケース性（監査Aの記述に依拠し，再確認していない）。')
P('- AI が同じ誤りを独立に2回犯す可能性（両監査とも同系統の AI による）。')
P()
P('## 14. 今後必要な人手確認')
P()
P('1. **II-TRI-190**（D）：境界 $a=\\pm\\frac1{\\sqrt2}$ の個数と (3) の組（第9節）。')
for (i, k), v in A_HUMAN.items(): P(f'1. **{i} ({k})**：{v}。小問 (2) の後ろ2つ（3重根の場合）の確認。')
P('1. B に分類した小問（数値・有界探索依存）の解析的な裏付け。')
P('1. 判定不能のうち監査Aで方法の帰属がない小問：どの小問に数値計算・探索を使ったかの確認。')
P('1. 証明小問と保存済み解説の論証の検証（別監査）。')
P()
P('## 付録：整合性チェックの結果')
P()
P('| チェック | 結果 |')
P('|---|---|')
for k, v in checks.items(): P(f'| {k} | {"OK" if v else "NG"} |')
P()
P('### 記録上の注意（修正はしていない）')
P()
for x in issues: P(f'- {x}')
if not issues: P('- なし')
P()
P('## ファイル')
P()
P('- `problem_summary.csv`：254問，1行1問。')
P(f'- `subproblem_summary.csv`：{N} 小問，1行1小問。`independent_answer`・`stored_answer` は長いものを160字で切っている。')
P('- `build.py`：このディレクトリの3ファイルを生成するスクリプト（リポジトリのルートで実行）。')
open(os.path.join(OUT, 'aggregate_report.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')

print(json.dumps({'checks_ok': all(checks.values()), 'failed': [k for k, v in checks.items() if not v],
                  'problem': {k: pc[k] for k in 'ABCD'}, 'sub': dict(sc_all), 'sub_by_src': {k: dict(v) for k, v in sc_src.items()},
                  'unresolved': dict(unresolved_reasons), 'N': N, 'DEN': DEN, 'issues': issues}, ensure_ascii=False, indent=1))
sys.exit(0 if all(checks.values()) else 1)
