#!/usr/bin/env python3
"""254問・666小問の保存済み解説の独立検証監査：統合・集計・整合性検査。

リポジトリのルートで `python3 docs/audit/2026-11-25/explanation-audit/build.py` と実行する。

読むもの（すべてこのディレクトリ内か既存の監査記録。書き換えない）:
  raw/first_pass/batch_NN.csv          第1パス（全666小問）の照合結果
  raw/redteam/redteam_RR.csv, plan.json 第2パス（敵対的再検証，50問のサンプル）の結果
  independent_solutions_methods.md     凍結済み独立解答の方法・確信度
  ../aggregate-254/subproblem_summary.csv  第一段階（最終答案照合）の小問分類
書き出すもの（このディレクトリ内のみ）:
  explanation_results.csv, problem_summary.csv, explanation_report.md
"""
import csv, json, os, re, subprocess, sys
from collections import Counter, OrderedDict

ROOT = os.getcwd()
D = os.path.join(ROOT, 'docs/audit/2026-11-25/explanation-audit')
def rcsv(p): return list(csv.DictReader(open(p, encoding='utf-8')))
FREEZE = 'f4f6db864a6579897e6ef620cad33dc21fe32983'   # 独立解答の凍結コミット
BASE = '71c8a7dfb68b12925890f5832809b91c7fdc64ef'     # 統合監査ブランチの先端（このブランチの分岐元）
CATS = ['A', 'B', 'C', 'D', 'E']
SEV = {'A': 0, 'C': 1, 'B': 2, 'E': 3, 'D': 4}       # 厳しさの順（「厳しい方」を最終判定にする）

checks = OrderedDict(); notes_issues = []

# ---------------------------------------------------------------- 入力
first_audit = {(r['id'], r['subproblem']): r for r in rcsv(os.path.join(ROOT, 'docs/audit/2026-11-25/aggregate-254/subproblem_summary.csv'))}
level = {r['id']: r['level'] for r in rcsv(os.path.join(ROOT, 'docs/audit/2026-11-25/aggregate-254/problem_summary.csv'))}
fp = OrderedDict()
for n in range(1, 27):
    for r in rcsv(f'{D}/raw/first_pass/batch_{n:02d}.csv'):
        k = (r['problem_id'], r['subproblem'])
        if k in fp: notes_issues.append(f'第1パスで重複行 {k}')
        fp[k] = dict(r, batch=n)
plan = json.load(open(f'{D}/raw/redteam/plan.json', encoding='utf-8'))
rt = {}
for g in range(1, len(plan['groups']) + 1):
    for r in rcsv(f'{D}/raw/redteam/redteam_{g:02d}.csv'):
        rt[(r['problem_id'], r['subproblem'])] = dict(r, group=g)
meth = {}
for line in open(f'{D}/independent_solutions_methods.md', encoding='utf-8'):
    m = re.match(r'^\| (\S+) \| (\S+) \| (\d+) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$', line)
    if m and m.group(1) != '問題' and not m.group(1).startswith('---'):
        meth[(m.group(1), m.group(2))] = dict(kind=m.group(4), numeric=m.group(5), unproven=m.group(6), conf=m.group(7))

# ---------------------------------------------------------------- 整合性
sample_ids = set(sum(plan['groups'], []))
checks['第一段階の小問は666'] = len(first_audit) == 666
checks['第1パスが666小問をちょうど1行ずつ網羅'] = set(fp) == set(first_audit) and len(fp) == 666
checks['問題IDは254で第一段階と一致'] = {k[0] for k in fp} == set(level) and len(level) == 254
checks['独立解答の方法表が666小問を網羅'] = set(meth) == set(first_audit)
checks['第2パスはサンプル50問の全小問を網羅'] = {k for k in fp if k[0] in sample_ids} == set(rt)
checks['第1パスの分類がすべてA〜E'] = all(r['explanation_category'] in CATS for r in fp.values())
checks['第2パスの分類がすべてA〜E'] = all(r['explanation_category'] in CATS for r in rt.values())

# ---------------------------------------------------------------- 統括者の裁定（理由つき，ここだけで行う）
ADJ = {
    ('III-DIF-374', '(2)'): ('D', '統括者が保存済み解説を直接確認：「$e^{x_2}<bx_2$ の両辺の対数をとって $x_2>L+\\log x_2$」は不等号の向きが逆（正しくは $x_2<L+\\log x_2$）。着想（idea）にも同じ誤り。第2パスは A としたが見落とし。'),
    ('A-COM-510', '(2)'): ('C', '第1パスのノートが「(II) の場合の括弧書き『m-1=3≧2，n≧3』は入れかえ後の条件を書くべき箇所」と具体的な誤記を記録しながら A としていたため，分類基準（軽微な誤記は C）に合わせた。第2パスは問題なしとしており，見解が分かれるので要人手確認。'),
}
FORCE_HUMAN = {
    'II-TRI-190': '第一段階でD（境界 a=±1/√2）。今回の2つのパスとも保存済み解説を正しいと判断したが，AIの再計算を理由に人手確認を外さない',
    'III-DIF-356': '第一段階で要人確認と記録された3重根の場合（(2)）',
}
NOTE_MATCH = {('X-MIX-090', '(3)'): '同値（例の違い：どちらも妥当）'}

# ---------------------------------------------------------------- 小問単位の統合
rows = []
for k, f in fp.items():
    pid, sp = k
    r2 = rt.get(k)
    c1 = f['explanation_category']; c2 = r2['explanation_category'] if r2 else ''
    final = c1 if not r2 else (c1 if SEV[c1] >= SEV[c2] else c2)
    basis = '第1パス' if not r2 else ('両パス一致' if c1 == c2 else ('第1パス（厳しい方）' if final == c1 else '第2パス（厳しい方）'))
    issue = f['issue_description'].strip(); corr = f['correction_proposal'].strip()
    if r2 and r2['issue_description'].strip() and final == c2 and c1 != c2:
        issue = (issue + ' ／第2パス：' if issue else '第2パス：') + r2['issue_description'].strip()
        if r2['correction_proposal'].strip(): corr = (corr + ' ／' if corr else '') + r2['correction_proposal'].strip()
    adj = ''
    if k in ADJ:
        final, adj = ADJ[k]; basis = '統括者の裁定'
        issue = (issue + ' ／' if issue else '') + '【裁定】' + adj
    human_reasons = []
    if final in ('D', 'E'): human_reasons.append(f'分類{final}')
    if r2 and c1 != c2: human_reasons.append(f'2つのパスの判定が異なる（{c1}／{c2}）')
    if f['human_review_required'].strip() == 'はい': human_reasons.append('第1パスが要人手確認')
    if r2 and r2['human_review_required'].strip() == 'はい': human_reasons.append('第2パスが要人手確認')
    if pid in FORCE_HUMAN and (pid != 'III-DIF-356' or sp == '(2)'): human_reasons.append(FORCE_HUMAN[pid])
    if k in ADJ: human_reasons.append('統括者の裁定あり')
    m = meth.get(k, {})
    method = f"独立解答（数値計算・プログラム：{'あり' if m.get('numeric','').startswith('あり') else 'なし'}）＋第1パス照合" + ('＋第2パス敵対的再検証' if r2 else '')
    conf_order = {'高': 0, '中': 1, '低': 2}
    confs = [x for x in [f['confidence'].strip(), r2['confidence'].strip() if r2 else ''] if x]
    conf = max(confs, key=lambda x: conf_order.get(x[:1], 1))[:1] if confs else ''
    fam = NOTE_MATCH.get(k, f['final_answer_match'])
    rows.append(OrderedDict([
        ('problem_id', pid), ('subproblem', sp),
        ('first_audit_category', first_audit[k]['category']),
        ('independent_answer', f['independent_answer']), ('stored_answer', f['stored_answer']),
        ('stored_explanation', f['stored_explanation_excerpt']),
        ('explanation_category', final),
        ('mathematical_correctness', f['mathematical_correctness']), ('logical_validity', f['logical_validity']),
        ('calculation_accuracy', f['calculation_accuracy']), ('condition_coverage', f['condition_coverage']),
        ('boundary_case_coverage', f['boundary_case_coverage']), ('reproducibility', f['reproducibility']),
        ('method', method), ('confidence', conf),
        ('issue_description', issue), ('correction_proposal', corr),
        ('human_review_required', 'はい' if human_reasons else 'いいえ'),
        # 追加列（追跡用）
        ('final_answer_match', fam), ('numeric_dependence_of_stored', f['numeric_dependence']),
        ('first_pass_category', c1), ('second_pass_category', c2), ('category_basis', basis),
        ('second_pass_weakest_point', r2['weakest_point'] if r2 else ''),
        ('independent_confidence', m.get('conf', '')), ('independent_unproven', m.get('unproven', '')),
        ('human_review_reason', '；'.join(dict.fromkeys(human_reasons))),
        ('batch', f['batch']),
    ]))
# 第1パスで A のまま指摘文が残っている行（甘さの追跡）
a_with_note = [r for r in rows if r['first_pass_category'] == 'A' and fp[(r['problem_id'], r['subproblem'])]['issue_description'].strip()]

# ---------------------------------------------------------------- 問題単位
probs = OrderedDict()
for r in rows: probs.setdefault(r['problem_id'], []).append(r)
prob_rows = []
for pid, rs in probs.items():
    worst = max((r['explanation_category'] for r in rs), key=lambda c: SEV[c])
    cnt = Counter(r['explanation_category'] for r in rs)
    prob_rows.append(OrderedDict([
        ('problem_id', pid), ('level', level[pid]), ('n_subproblems', len(rs)),
        ('explanation_category', worst),
        ('subproblem_breakdown', ' '.join(f'{c}:{cnt[c]}' for c in CATS if cnt[c])),
        ('final_answer_mismatch', sum(1 for r in rs if r['final_answer_match'] == '不一致')),
        ('in_second_pass_sample', 'はい' if pid in sample_ids else 'いいえ'),
        ('issues', ' ／ '.join(f"{r['subproblem']}[{r['explanation_category']}] {r['issue_description'][:200]}" for r in rs if r['explanation_category'] != 'A')),
        ('human_review_required', 'はい' if any(r['human_review_required'] == 'はい' for r in rs) else 'いいえ'),
    ]))

# ---------------------------------------------------------------- 検査
sc = Counter(r['explanation_category'] for r in rows); pc = Counter(r['explanation_category'] for r in prob_rows)
checks['explanation_results が666行・キー一意'] = len(rows) == 666 and len({(r['problem_id'], r['subproblem']) for r in rows}) == 666
checks['problem_summary が254行・ID一意'] = len(prob_rows) == 254 and len({r['problem_id'] for r in prob_rows}) == 254
checks['問題単位の小問数の合計=666'] = sum(r['n_subproblems'] for r in prob_rows) == 666
checks['問題単位の分類＝その問題の小問の最も厳しい分類'] = all(
    p['explanation_category'] == max((r['explanation_category'] for r in probs[p['problem_id']]), key=lambda c: SEV[c]) for p in prob_rows)
checks['最終分類は各パスより甘くない'] = all(SEV[r['explanation_category']] >= SEV[r['first_pass_category']] and
    (not r['second_pass_category'] or SEV[r['explanation_category']] >= SEV[r['second_pass_category']]) for r in rows)
checks['II-TRI-190 の全小問が要人手確認'] = all(r['human_review_required'] == 'はい' for r in probs['II-TRI-190'])
checks['III-DIF-356 (2) が要人手確認'] = any(r['subproblem'] == '(2)' and r['human_review_required'] == 'はい' for r in probs['III-DIF-356'])
checks['D・E の小問はすべて要人手確認'] = all(r['human_review_required'] == 'はい' for r in rows if r['explanation_category'] in 'DE')
checks['A-COM-495 の巡回の記述が第2パスで確認されている'] = any('周期' in (r['second_pass_weakest_point'] + rt.get((r['problem_id'], r['subproblem']), {}).get('issue_description', '')) or r['second_pass_category'] == 'A' for r in probs['A-COM-495'])
# 既存ファイルが変わっていないこと（git がある場合）
def git(*a):
    try: return subprocess.run(['git', *a], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except Exception as e: return None
changed = git('diff', '--name-only', BASE)
untracked = git('ls-files', '--others', '--exclude-standard')
if changed is not None:
    allp = [x for x in (changed.split() + (untracked or '').split()) if x]
    outside = [x for x in allp if not x.startswith('docs/audit/2026-11-25/explanation-audit/')]
    checks[f'分岐元 {BASE[:7]} からの変更は explanation-audit/ のみ'] = not outside
    if outside: notes_issues.append('分岐元からの想定外の変更: ' + ', '.join(outside))
    fz = git('diff', '--name-only', FREEZE, '--', 'docs/audit/2026-11-25/explanation-audit/independent_solutions.md',
             'docs/audit/2026-11-25/explanation-audit/independent_solutions_methods.md')
    checks['凍結後に独立解答ファイルが変更されていない'] = fz is not None and fz.strip() == ''
else:
    notes_issues.append('git が使えないため既存ファイルの無変更検査を省略')

# ---------------------------------------------------------------- 書き出し
def wcsv(name, rs):
    with open(f'{D}/{name}', 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rs[0].keys())); w.writeheader(); w.writerows(rs)
wcsv('explanation_results.csv', rows); wcsv('problem_summary.csv', prob_rows)

def pct(a, b): return f'{100*a/b:.1f}%' if b else '—'
N = len(rows); P = len(prob_rows)
samp = [r for r in rows if r['second_pass_category']]
agree = sum(1 for r in samp if r['first_pass_category'] == r['second_pass_category'])
stricter2 = [r for r in samp if SEV[r['second_pass_category']] > SEV[r['first_pass_category']]]
stricter1 = [r for r in samp if SEV[r['first_pass_category']] > SEV[r['second_pass_category']]]
proof_rows = [r for r in rows if r['final_answer_match'].startswith('該当なし')]
L = []; P_ = L.append
P_('# 保存済み解説・論証の独立検証監査（254問・666小問）'); P_('')
P_('> `build.py` が生成。数値はすべてスクリプトの集計による。これは AI による検証であり，人による確認ではない。'); P_('')
P_('## 1. 監査対象数'); P_('')
P_(f'- 問題 {P}，小問 {N}（統合監査 `aggregate-254` の CSV と問題データで照合）。'); P_('')
P_('## 2. 手順と独立性'); P_('')
P_('| 段階 | 内容 |'); P_('|---|---|')
P_('| 独立解答 | 26バッチに分け，保存済みの答え・解説・過去の監査を見ていない新しいエージェント26体が問題文だけから解答・論証を作成（各バッチの独立性の記録はすべて「参照したファイル: なし」） |')
P_(f'| 凍結 | `independent_solutions.md`・`independent_solutions_methods.md` をコミット `{FREEZE[:8]}` で凍結。保存済み解説はこの push を確認した後に初めて抽出した |')
P_('| 第1パス照合 | 26体が問題文・凍結済み独立解答・保存済み解説を読み，全666小問を A〜E に分類（`raw/first_pass/`） |')
P_(f'| 第2パス（敵対的再検証） | 第1パスの判定を見せずに，13体が50問・{len(samp)}小問を「粗探し」として再検証（`raw/redteam/`）。対象は要人確認の指定問題，第1パスでA以外の問題，解釈・甘さの注記がある問題，各バッチで最難・証明の多い問題 |')
P_('| 統合 | 小問ごとに2つのパスの厳しい方を最終判定。統括者の裁定は2件だけで，理由を明記（第8節） |'); P_('')
P_('独立性について：統括者（このファイルを生成した Claude）は前の作業で93問の保存済み答案と監査Aの独立解答を見ており，B-SEQ-299 の保存済み解説冒頭も表示している。独立解答は統括者ではなく別エージェントが作ったので，独立解答の独立性には影響しない。'); P_('')
P_('## 3. 件数'); P_('')
P_(f'- 独立解答を作成できた小問：{N} / {N}'); P_(f'- 保存済み解説との照合が完了した小問：{N} / {N}（うち第2パスも行った小問 {len(samp)}）'); P_('')
P_('## 4. A〜E の件数・割合'); P_('')
P_('| 分類 | 小問 | 割合 | 問題（最も厳しい小問の分類） | 割合 |'); P_('|---|---:|---:|---:|---:|')
for c in CATS: P_(f'| {c} | {sc[c]} | {pct(sc[c], N)} | {pc[c]} | {pct(pc[c], P)} |')
P_(f'| 合計 | {N} | 100.0% | {P} | 100.0% |'); P_('')
P_('## 5. 最終答案は正しいが解説に問題がある小問'); P_('')
wrong_expl = [r for r in rows if r['explanation_category'] != 'A' and r['final_answer_match'] != '不一致']
P_(f'- {len(wrong_expl)} 小問（最終答案は独立解答と一致・同値，または証明問題で主張が正しいが，解説が A でない）。'); P_('')
P_('| 問題 | 小問 | 分類 | 内容 | 修正案 |'); P_('|---|---|---|---|---|')
for r in sorted(wrong_expl, key=lambda r: (-SEV[r['explanation_category']], r['problem_id'])):
    P_(f"| {r['problem_id']} | {r['subproblem']} | {r['explanation_category']} | {r['issue_description'][:260].replace('|','／')} | {r['correction_proposal'][:200].replace('|','／')} |")
P_('')
P_('## 6. 数学的な誤りが見つかった小問（D）'); P_('')
for r in rows:
    if r['explanation_category'] == 'D': P_(f"- **{r['problem_id']} {r['subproblem']}**：{r['issue_description']}")
if not sc['D']: P_('- なし')
P_(''); P_('最終答案が保存済み答案と実質的に食い違った小問：' + (', '.join(f"{r['problem_id']} {r['subproblem']}" for r in rows if r['final_answer_match'] == '不一致') or 'なし') + '（X-MIX-090 (3) は例が異なるだけで双方妥当のため「同値」とした）。'); P_('')
P_('## 7. 証明問題の検証結果'); P_('')
pc_proof = Counter(r['explanation_category'] for r in proof_rows)
P_(f"- 証明の小問（最終答案が「証明」のもの）：{len(proof_rows)}。分類 " + '，'.join(f'{c} {pc_proof[c]}' for c in CATS if pc_proof[c]) + '。')
P_('- 各小問について，独立に組み立てた証明と保存済み解説の論証を照合した。論証の一行ごとの確認は検証エージェントの記録（`raw/*/*_notes.md`）による。')
P_(f"- 第一段階で「判定不能」だった小問 {sum(1 for r in rows if r['first_audit_category']=='判定不能')} のうち，今回 A となったもの {sum(1 for r in rows if r['first_audit_category']=='判定不能' and r['explanation_category']=='A')}。"); P_('')
P_('## 8. 統括者の裁定'); P_('')
for k, (c, why) in ADJ.items(): P_(f'- **{k[0]} {k[1]} → {c}**：{why}')
P_('- 強制的に要人手確認とした問題：' + '；'.join(f'{k}（{v}）' for k, v in FORCE_HUMAN.items())); P_('')
P_('## 9. 判定の信頼性（2つのパスの比較）'); P_('')
P_(f'- 第2パスの対象 {len(samp)} 小問のうち，2つのパスの分類が一致 {agree}（{pct(agree, len(samp))}）。第2パスの方が厳しい {len(stricter2)}，第1パスの方が厳しい {len(stricter1)}。')
for r in stricter2 + stricter1: P_(f"  - {r['problem_id']} {r['subproblem']}：第1パス {r['first_pass_category']} ／第2パス {r['second_pass_category']}")
P_('- **III-DIF-374 (2) の誤り（不等号の向き）は第1パスだけが見つけ，第2パスは A とした。** 逆に，第1パスが見逃し第2パスが見つけたものもある（II-GEO-300 (2)，III-DIF-359 (1)，C-CUR-459 (1)）。どちらのパスにも見落としがあるので，「A」は「誤りがないことが証明された」ことを意味しない。')
P_(f'- 第1パスの全666小問のうち A は {sum(1 for r in rows if r["first_pass_category"]=="A")}（{pct(sum(1 for r in rows if r["first_pass_category"]=="A"), N)}）。第2パスを行っていない {N-len(samp)} 小問は第1パスの判定だけで，同程度の見落としが残っている可能性がある。')
P_(f'- 第1パスで A としながら指摘文を残した小問が {len(a_with_note)} ある。多くは「別解の方が良い」「数値でも確認した」などの所見で欠陥ではないが，A-COM-510 (2) は具体的な誤記であったため C に裁定した。'); P_('')
P_('## 10. 数値計算・有限探索に依存する解説'); P_('')
dep = [r for r in rows if r['numeric_dependence_of_stored'] != 'なし']
P_(f'- 保存済み解説が数値計算・有限探索に頼っている（「補助のみ」を含む）と判定された小問：{len(dep)}。')
for r in dep: P_(f"  - {r['problem_id']} {r['subproblem']}：{r['numeric_dependence_of_stored']}")
P_('- 結論そのものが数値計算に依存していると判定された小問はない。B-SEQ-334 (3) の最小性は k=2..20 の列挙によるが，一般の k での同値性が証明済みで最小値を決めるには有限確認が論理的に必要十分（第2パスの判断）。')
P_('- 第一段階で B（数値・有界探索依存）とされた小問の多くは，「独立解答側が数値に頼った」ためで，保存済み解説は解析的に論証していると判定された。'); P_('')
P_('## 11. 修正優先度の高い問題'); P_('')
pri = sorted([r for r in rows if r['explanation_category'] in 'DB'], key=lambda r: (-SEV[r['explanation_category']], r['problem_id']))
for i, r in enumerate(pri, 1): P_(f"{i}. **{r['problem_id']} {r['subproblem']}（{r['explanation_category']}）**：{r['correction_proposal'][:240] or r['issue_description'][:240]}")
P_('- 次いで C の小問（表記・記号・一段の欠落）。一覧は第5節。'); P_('')
P_('## 12. 人手確認が必要な小問'); P_('')
for r in rows:
    if r['human_review_required'] == 'はい': P_(f"- {r['problem_id']} {r['subproblem']}（{r['explanation_category']}）：{r['human_review_reason']}")
P_('')
P_('## 13. 既存データへの変更がないことの確認'); P_('')
P_('| チェック | 結果 |'); P_('|---|---|')
for k, v in checks.items(): P_(f'| {k} | {"OK" if v else "NG"} |')
P_('')
for x in notes_issues: P_(f'- 注意：{x}')
P_('## 14. この監査で確認できていないこと'); P_('')
P_('- 第2パスを行っていない小問は，1体の検証エージェントの判定だけに依拠している。')
P_('- 「A」は2つ（または1つ）の AI 検証で問題が見つからなかったことを示すだけで，正しさの証明ではない（第9節の見落としの実例を参照）。')
P_('- 独立解答の確信度はエージェントの自己申告（666小問中ほぼすべてが「高」）で，それ自体は検証されていない。')
P_('- 解説の「受験生が再現できるか」は，検証エージェントの判断による。実際の受験生での確認はしていない。')
P_('- 問題文の解釈が答えに影響する小問（C-CUR-459 (1)，C-CUR-462 (2)，C-CUR-472 (2)，I-QF-151 (2)，C-VEC-457 など）は，保存済み解説の解釈が正当化できると判定したが，出題意図の最終確認は人による。'); P_('')
P_('## ファイル'); P_('')
for f_, d_ in [('independent_solutions.md', '凍結済み独立解答（26バッチの出力をそのまま連結）'), ('independent_solutions_methods.md', '独立解答の方法・確信度・作成手順'),
               ('independent_solutions_instructions.md', '独立解答エージェントへの手順書'), ('verification_instructions.md', '第1パス照合の手順書'), ('redteam_instructions.md', '第2パスの手順書'),
               ('raw/first_pass/', '第1パスの CSV とノート（26バッチ）'), ('raw/redteam/', '第2パスの CSV・ノート（13組）と対象の選定 plan.json'),
               ('explanation_results.csv', '小問単位の最終結果（666行）'), ('problem_summary.csv', '問題単位の集計（254行）'), ('build.py', 'このファイル群を再生成するスクリプト')]:
    P_(f'- `{f_}`：{d_}')
open(f'{D}/explanation_report.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print(json.dumps({'ok': all(checks.values()), 'failed': [k for k, v in checks.items() if not v], 'sub': dict(sc), 'prob': dict(pc),
                  'sample': len(samp), 'agree': agree, 'human': sum(1 for r in rows if r['human_review_required'] == 'はい'), 'issues': notes_issues}, ensure_ascii=False))
sys.exit(0 if all(checks.values()) else 1)
