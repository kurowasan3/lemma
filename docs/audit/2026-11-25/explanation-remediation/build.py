#!/usr/bin/env python3
"""解説監査の精査・修正フェーズ：記録の生成と整合性検査。

リポジトリのルートで `python3 docs/audit/2026-11-25/explanation-remediation/build.py` と実行する。

読むもの：
  audit_snapshot.csv          解説監査（PR #2，コミット 500b033）の explanation_results.csv から対象行だけを写したもの
  apply_fixes.py              適用した修正（修正前・修正後の文）
  recheck/*.csv               修正していない別エージェントによる修正後の再検証
  content/problems/*.json と git の分岐元（BASE）の同じファイル
書き出すもの（このディレクトリ内のみ）：
  remediation_results.csv, human_review_required.md, before_after.md, remediation_report.md
"""
import csv, difflib, glob, importlib.util, json, os, subprocess, sys
from collections import OrderedDict

ROOT = os.getcwd()
D = os.path.join(ROOT, 'docs/audit/2026-11-25/explanation-remediation')
BASE = 'c3193afacdceeece990b9c4ef99046f9b94b0285'  # 修正ブランチの分岐元（origin/main）
AUDIT_COMMIT = '500b0336a86642c47dbe70460c50c4166eea0f50'
def git(*a):
    r = subprocess.run(['git', *a], cwd=ROOT, capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None
spec = importlib.util.spec_from_file_location('apply_fixes', os.path.join(D, 'apply_fixes.py'))
AF = importlib.util.module_from_spec(spec); spec.loader.exec_module(AF)

snap = OrderedDict(((r['problem_id'], r['subproblem']), r) for r in csv.DictReader(open(f'{D}/audit_snapshot.csv', encoding='utf-8')))
recheck = {}
# 実施順：X・Y・Z（1回目），W（B-SEQ-342 の付け替え漏れを直したあとの2回目）。同じ問題では後の結果を最終とする
ORDER = ['X', 'Y', 'Z', 'W']
for who in ORDER:
    f = f'{D}/recheck/{who}.csv'
    for r in csv.DictReader(open(f, encoding='utf-8')):
        recheck.setdefault(r['problem_id'], []).append(dict(r, who=who))

# ---------------------------------------------------------------- 原本との照合結果と修正の判断（修正担当＝統括者）
FIX_TARGETS = ['III-DIF-374 (2)', 'A-GEO-115 (1)', 'C-CUR-459 (1)', 'C-CUR-484 (2)', 'II-GEO-300 (2)', 'III-DIF-380 (2)',
               'A-COM-510 (2)', 'B-SEQ-342 (1)', 'B-SEQ-342 (2)', 'B-SEQ-342 (3)', 'II-CAL-312 (3)', 'III-DIF-359 (1)']
HUMAN_TARGETS = ['II-TRI-190 (1)', 'II-TRI-190 (2)', 'II-TRI-190 (3)', 'III-DIF-356 (2)', 'III-DIF-374 (2)', 'A-COM-510 (2)',
                 'B-SEQ-342 (1)', 'B-SEQ-342 (2)', 'B-SEQ-342 (3)', 'C-CUR-459 (1)', 'II-GEO-300 (2)', 'III-DIF-359 (1)', 'III-DIF-380 (2)']
V = {  # verification_result（原本を読んで確かめた結果），status，summary，human（人が判断すべきこと）
 'III-DIF-374 (2)': ('指摘は正しい。解説 (2) の「$e^{x_2}<bx_2$ の両辺の対数をとって $x_2>L+\\log x_2$」は誤り（対数をとると $x_2<L+\\log x_2$）。着想にも同じ誤り。後続で使う $x_2>L+\\log L$ 自体は真で，$f(L+\\log L)=e^2-b\\log L<0$（$\\log L>\\log4>1$，$b>e^4$）と $f$ の $x\\geqq L$ での増加から導ける。その後の評価（$(e^2+1)\\log L>8$，$(e^{x_1}-1)L<4(e+1)/e^2<3$）は確認して正しい。',
                     '修正済み', '誤った1行を，$x_4=L+\\log L$ で $f(x_4)<0$ を示して $x_2>x_4$ を導く論証に置き換えた。着想の対応箇所も $f(\\log b+\\log\\log b)<0$ による正しい根拠に直した。',
                     '修正後の論証が正しいか（特に $\\log L>1$ と $f$ の単調性の使い方）。'),
 'A-GEO-115 (1)': ('指摘は正しい。「K は B，C と異なるから P，L とも異なる」は理由になっていない。K$\\neq$P は「P は直線 BC 上にない（直線 AB と BC は B だけで交わり P$\\neq$B）」，K$\\neq$L は「直線 BC と AD の交点 Q は線分 BC の外にあり，線分 BC は直線 AD と交わらない」から従う。K$\\neq$B，C も直線 PL が直線 PA，PD と P だけで交わることから従う。',
                   '修正済み', 'K$\\neq$B，C，K$\\neq$P，K$\\neq$L のそれぞれの根拠を書き加えた。', ''),
 'C-CUR-459 (1)': ('指摘は正しい。解説は楕円を $\\alpha>\\beta>0$ と置いた時点で円（$s=\\frac13$ で F，A，H を通る円が存在）を除いているが根拠がない。「2つの焦点」を相異なる2点と読めば円は除かれ，答え $0<s<\\frac13$ と (3) の端点が決まる。',
                   '修正済み', '「楕円の2つの焦点は相異なる2点で，円はそのような2つの焦点をもたないので $\\alpha=\\beta$ を含めない」を書き加えた。',
                   '出題意図として円（2つの焦点が一致する場合）を除くことが正しいか。除かない読み方なら (1) は $0<s\\leqq\\frac13$ となり，(2)(3) にも影響する。'),
 'C-CUR-484 (2)': ('指摘は正しい。(a) 各 $\\lambda\\neq0$ で E，F が実在すること：A での接線の傾きは $-\\frac12$ で，$k_1\\neq k_2$，和 $\\lambda$，ともに $-\\frac12$ でない傾きをとれば E，F がとれる。(b) $k_1+k_2=0$ で EF が $y=\\frac12x-2$ と一致するのは $u=\\frac16$ のときで，その直線 $x-2y=4$ は $C$ と $(2y+3)^2=0$ で接するだけなので起こらない。',
                   '修正済み', '(a)(b) をそれぞれ1文で書き加えた。', ''),
 'II-GEO-300 (2)': ('指摘は正しい（第2パス）。直線を $qy+r=0$ と書くと $\\eta=q^2(y_1-m)(y_2-m)$ で $q^2>0$ なので符号は同じ。結論に誤りはない。',
                    '修正済み', '方程式の書き方によらず符号が同じであることを1文で書き加えた。',
                    '第1パス（A，軽微）と第2パス（B）で判定が分かれた。補足の要否と程度。'),
 'III-DIF-380 (2)': ('指摘は正しい。解説の論証から「解がちょうど2個」⇔「$a>1$ または $b>1$」かつ $ab\\neq e$ で，$\\gamma>0\\iff ab<e$ はこの前提の下での同値。$a,b$ だけの条件は「($a>1$ または $b>1$) かつ $ab<e$」。$a,b\\leqq1$ でも $ab<e$ は成り立つので，前提を外すと答えとして不十分。',
                     '修正済み（答えも修正）', '答えに「解がちょうど2個のとき」と，$a,b$ だけの条件としての形を併記した。解説の結びにも同じことを書き加えた。',
                     '答え欄の書き方（前提つきの同値と，$a,b$ だけの条件の併記）でよいか。入力用の答え（自動採点）はこの問題にはない。'),
 'A-COM-510 (2)': ('原本を照合した結果，括弧書き「$m-1=3\\geqq2$，$n\\geqq3$」は「1辺2の正方形が表に収まる条件（3行以上かつ3列以上）」として正しく，(II) の場合の「行と列を入れかえた条件」（$2\\leqq n-1$，$p+2\\leqq m=4$）とも同じ内容で，続く $w_3=-w_1$，$w_4=-w_2$ に必要十分。誤記ではないと判断した（第2パスの判断と一致）。前回の監査で統括者が C と裁定したのは過剰だった可能性が高い。',
                   '修正せず（不要と判断）', '変更なし。', '前回の裁定（C）と今回の判断（修正不要）のどちらが妥当か。'),
 'B-SEQ-342 (1)': ('指摘は正しい。問題文で $b=a_2$ なのに，解説が補助数列を $b_n=\\beta(a_n)$ と置くため，例えば (1) で $b=2$ なのに $b_2=\\frac13$ となり紛らわしい。数学的内容に誤りはない。',
                   '修正済み', '補助数列を $b_n$ から $d_n$ に付け替えた（解説 51 箇所，着想 10 箇所）。1回目は正規表現の誤りで積の2つ目の因子（$d_mb_n$ の $b_n$ など）7箇所が漏れ，再検証（Z）で指摘されて直した。指示書の例 $c_n$ は，解説の「準備」で定数 $c$ が使われているため新たな衝突を生むので，未使用の $d$ を選んだ。',
                   '記号の付け替え（$d_n$）が読みやすいか。第2パスは A（衝突は軽微）と判断していた。'),
 'II-CAL-312 (3)': ('指摘は正しい。$3c(3-\\beta)=3$ と $c(\\beta-1)=3$ をそのまま加えても $2c=4$ にならない。前者を3で割って $c(3-\\beta)=1$ とすれば $c(3-\\beta)+c(\\beta-1)=2c=4$。結論 $c=2$，$\\beta=\\frac52$ は正しい。',
                    '修正済み', '「前者を3で割ると $c(3-\\beta)=1$ で」を補った。', ''),
 'III-DIF-359 (1)': ('指摘は正しい（第2パス）。奇数 $k$ の項は $x=-1$ で $\\varphi_k(-1)=e^{-1}-e<0$ なので $|\\varphi_k|=-\\varphi_k$ で微分係数 $-ke^{-1}$。その和 $D=-e^{-1}\\sum_{k\\text{奇}}c_kk$ が両側に加わり，右・左の微分係数は $D\\pm eE$。微分可能 $\\iff E=0$ という結論は変わらない。',
                     '修正済み', '奇数 $k$ の項の寄与 $D$ を明記し，右側・左側の微分係数を $D+eE$，$D-eE$ と正しく書いた。', ''),
}
V['B-SEQ-342 (2)'] = V['B-SEQ-342 (1)']; V['B-SEQ-342 (3)'] = V['B-SEQ-342 (1)']
HUMAN_ONLY = {
 'II-TRI-190 (1)': ('第一段階で D（境界 $a=\\pm\\frac1{\\sqrt2}$）。解説監査では第1パス・第2パスとも保存済み解説を正しいと判断（厳密な数え上げで確認）。今回は修正対象外。', '対象外（人手確認のみ）',
                    '$a=\\pm\\frac1{\\sqrt2}$ のとき $\\sin(x+\\frac\\pi4)=\\mp1$ の解が1周期に1個で，$N(\\frac1{\\sqrt2},n)$ が $n$ 偶数で $\\frac{3n}2$，奇数で $\\frac{3n-1}2$，$N(-\\frac1{\\sqrt2},n)$ が偶数で $\\frac{3n}2$，奇数で $\\frac{3n+1}2$ であること。(3) で $n=1350$ を含めること。'),
 'III-DIF-356 (2)': ('第一段階で「後ろ2つ（3重根の場合）は要人確認」と記録された。解説監査では両パスとも A（3重根の場合の扱いは正しい）。今回は修正対象外。', '対象外（人手確認のみ）',
                     '$f\'$ が3重根をもつ型の2つ（無理数係数，$x_0^3=\\pm4$）を答えに含めることが出題意図に合うか。'),
}
HUMAN_ONLY['II-TRI-190 (2)'] = HUMAN_ONLY['II-TRI-190 (1)']; HUMAN_ONLY['II-TRI-190 (3)'] = HUMAN_ONLY['II-TRI-190 (1)']

def final_verdict(pid):
    rs = recheck.get(pid, [])
    return rs[-1]['verdict'] if rs else ''
def recheck_summary(pid):
    rs = recheck.get(pid, [])
    if not rs: return '未実施', ''
    s = '；'.join(f"{r['who']}：{r['verdict']}（解消：{r['issue_resolved']}，新しい誤り：{r['new_errors']}）" for r in rs)
    if pid == 'B-SEQ-342':
        s += '。Z の「修正に問題あり」は1回目の付け替え（積の2つ目の因子 b_n が7箇所残った）に対するもので，直したあとの W が最終'
    last = rs[-1]
    rem = '；'.join(f"{r['who']}：{r['remaining_issue']}" for r in rs if r['remaining_issue'].strip() and (r is last or r['verdict'] not in ('修正に問題あり',)))
    return s, rem

rows = []
for key in FIX_TARGETS + [k for k in HUMAN_ONLY]:
    pid, sp = key.rsplit(' ', 1)
    a = snap[(pid, sp)]
    if key in V: vr, st, summ, hum = V[key]
    else: vr, st, hum = HUMAN_ONLY[key]; summ = '変更なし。'
    rc, rem = recheck_summary(pid) if key in V else ('対象外', '')
    human = key in HUMAN_TARGETS
    rows.append(OrderedDict([
        ('problem_id', pid), ('subproblem', sp), ('original_category', a['explanation_category']),
        ('original_issue', a['issue_description']), ('verification_result', vr), ('modification_status', st),
        ('modification_summary', summ), ('independent_recheck', rc),
        ('human_review_required', 'はい' if human else 'いいえ'), ('remaining_issue', rem),
        ('human_decision_needed', hum if human else ''),
        ('first_pass_category', a['first_pass_category']), ('second_pass_category', a['second_pass_category']),
        ('audit_category_basis', a['category_basis']), ('audit_human_review_reason', a['human_review_reason']),
    ]))

# ---------------------------------------------------------------- 検査
checks = OrderedDict(); notes = []
checks['修正対象12小問がすべて記録されている'] = all(any(r['problem_id'] + ' ' + r['subproblem'] == k for r in rows) for k in FIX_TARGETS) and len(FIX_TARGETS) == 12
checks['人手確認13小問がすべて「はい」'] = len(HUMAN_TARGETS) == 13 and all(r['human_review_required'] == 'はい' for r in rows if r['problem_id'] + ' ' + r['subproblem'] in HUMAN_TARGETS)
checks['II-TRI-190 の人手確認を解除していない'] = all(r['human_review_required'] == 'はい' for r in rows if r['problem_id'] == 'II-TRI-190')
checks['監査スナップショットが監査結果と同じ（PR #2 のコミットから再取得して比較）'] = True
full = git('show', f'{AUDIT_COMMIT}:docs/audit/2026-11-25/explanation-audit/explanation_results.csv')
if full is not None:
    import io
    fr = {(r['problem_id'], r['subproblem']): r for r in csv.DictReader(io.StringIO(full))}
    checks['監査スナップショットが監査結果と同じ（PR #2 のコミットから再取得して比較）'] = all(fr[k]['issue_description'] == v['issue_description'] and fr[k]['explanation_category'] == v['explanation_category'] for k, v in snap.items())
else:
    notes.append('監査コミットが手元にないため，スナップショットの照合を省略')
changed = git('diff', '--name-only', BASE)
allowed_content = {'content/problems/III-16.json', 'content/problems/A-06.json', 'content/problems/C-19.json',
                   'content/problems/II-09.json', 'content/problems/B-13.json', 'content/problems/II-12.json'}
if changed is not None:
    ch = [x for x in changed.split() if x]
    unt = [x for x in (git('ls-files', '--others', '--exclude-standard') or '').split() if x]
    bad = [x for x in ch + unt if not (x in allowed_content or x.startswith('data/') or x.startswith('docs/audit/2026-11-25/explanation-remediation/'))]
    checks['変更は対象の content 6ファイル・data/・このディレクトリだけ'] = not bad
    if bad: notes.append('想定外の変更: ' + ', '.join(bad))
    # content：対象9問の答え・解説・着想以外が変わっていない
    TARGET9 = set(AF.FILES)
    def items(d): return d if isinstance(d, list) else d.get('problems', [d])
    field_changes, ok = [], True
    for path in sorted(allowed_content):
        old = {x['id']: x for x in items(json.loads(git('show', f'{BASE}:{path}')))}
        new = {x['id']: x for x in items(json.load(open(os.path.join(ROOT, path), encoding='utf-8')))}
        if old.keys() != new.keys(): ok = False
        for i in old:
            if old[i] != new[i]:
                diff = sorted(k for k in set(old[i]) | set(new[i]) if old[i].get(k) != new[i].get(k))
                field_changes.append((i, diff))
                if i not in TARGET9 or not set(diff) <= {'answer', 'solutions', 'idea'}: ok = False
    checks['content：対象9問の答え・解説・着想だけが変わり，ID・問題文・タグ・難易度・品質は不変'] = ok and {i for i, _ in field_changes} == TARGET9
    checks['答えを変えたのは III-DIF-380 だけ'] = [i for i, d in field_changes if 'answer' in d] == ['III-DIF-380']
    # data：対象9問の s/k/a と dataVersion 以外が変わっていない
    dok = True
    for path in [x for x in ch if x.startswith('data/')]:
        a = json.loads(git('show', f'{BASE}:{path}')); b = json.load(open(os.path.join(ROOT, path), encoding='utf-8'))
        def strip(x):
            if isinstance(x, dict):
                return {k: (strip(v) if k not in ('dataVersion',) else None) for k, v in x.items() if not (k in TARGET9)}
            return x
        if strip(a) != strip(b): dok = False
    checks['data：対象9問と dataVersion 以外は不変'] = dok
    checks['修正は apply_fixes.py の記録どおり（--check がすべて適用済み）'] = subprocess.run([sys.executable, '-I', os.path.join(D, 'apply_fixes.py'), '--check'], cwd=ROOT, capture_output=True, text=True).stdout.count('適用済み') == len(AF.FIXES) + 2
else:
    notes.append('git が使えないため差分検査を省略')
checks['修正した11小問すべてに別エージェントの再検証がある'] = all(r['independent_recheck'] not in ('未実施',) for r in rows if r['modification_status'].startswith('修正'))
checks['最終の再検証で「修正に問題あり」「修正が必要」がない'] = not any(final_verdict(p) in ('修正に問題あり', '修正が必要') for p in recheck)
checks['途中で見つかった問題（B-SEQ-342 の付け替え漏れ）は2回目の再検証で解消'] = final_verdict('B-SEQ-342') == '修正は正しい' and any(x['verdict'] == '修正に問題あり' for x in recheck.get('B-SEQ-342', []))

# ---------------------------------------------------------------- 書き出し
with open(f'{D}/remediation_results.csv', 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

H = ['# 人手確認が必要な13小問', '', 'AI による精査・修正・再検証の結果を記録する。**ここに挙げた小問は，AI の判断だけで解決済みにしていない。**', '']
for key in HUMAN_TARGETS:
    r = next(x for x in rows if x['problem_id'] + ' ' + x['subproblem'] == key)
    H += [f'## {key}', '',
          f'1. 人手確認が必要とされた理由：{r["audit_human_review_reason"] or "—"}',
          f'2. 第1パスの判断：{r["first_pass_category"] or "—"}',
          f'3. 第2パスの判断：{r["second_pass_category"] or "（第2パスの対象外）"}',
          f'4. 統括者の裁定：{"あり（" + r["original_category"] + "）" if r["audit_category_basis"] == "統括者の裁定" else "なし（判定根拠：" + r["audit_category_basis"] + "）"}',
          f'5. 原本を確認した結果：{r["verification_result"]}',
          f'6. AI による再検証の結果：{r["modification_status"]}。{r["modification_summary"]} 再検証：{r["independent_recheck"]}' + (f' 残る点：{r["remaining_issue"]}' if r['remaining_issue'] else ''),
          f'7. 人間が最終的に判断すべき事項：{r["human_decision_needed"]}', '']
open(f'{D}/human_review_required.md', 'w', encoding='utf-8').write('\n'.join(H) + '\n')

B = ['# 修正前後の記録', '',
     f'- 分岐元（修正前）：`{BASE}`（main）。修正は `apply_fixes.py` で適用した。',
     '- **管理表への反映が必要**：`content/` は `Lemma問題管理表.xlsx` から `tools/import_xlsx.py` で作り直される。下の「修正後（全文）」を管理表の該当セル（I 列＝答え，J 列＝解答・解説，K 列＝着想）に入れないと，次の取り込みで修正が消える。', '']
if changed is not None:
    def items(d): return d if isinstance(d, list) else d.get('problems', [d])
    for pid, path in sorted(AF.FILES.items()):
        old = {x['id']: x for x in items(json.loads(git('show', f'{BASE}:{path}')))}[pid]
        new = {x['id']: x for x in items(json.load(open(os.path.join(ROOT, path), encoding='utf-8')))}[pid]
        B += [f'## {pid}（`{path}`）', '']
        pairs = [('答え（I 列）', old['answer']['tex'], new['answer']['tex'])]
        pairs += [(f'解答・解説（J 列）{s["id"]}', o['tex'], s['tex']) for o, s in zip(old['solutions'], new['solutions'])]
        if new.get('idea'): pairs.append(('着想（K 列）', old['idea']['tex'], new['idea']['tex']))
        for name, a, b in pairs:
            if a == b: continue
            B += [f'### {name}：差分', '', '```diff', *difflib.unified_diff(a.splitlines(), b.splitlines(), '修正前', '修正後', lineterm='', n=1), '```', '',
                  f'<details><summary>{name}：修正後（全文，管理表に貼る内容）</summary>', '', '```latex', b, '```', '', '</details>', '']
open(f'{D}/before_after.md', 'w', encoding='utf-8').write('\n'.join(B) + '\n')

n_fixed = sum(1 for r in rows if r['modification_status'].startswith('修正済み'))
R = ['# 解説監査結果の精査・修正（2026-11-25）', '', '> `build.py` が生成。これは AI による精査・修正であり，人による確認ではない。', '',
     '## 1. 対象と結果', '',
     f'- 修正対象 12 小問（解説監査で B・C・D）：原本と照合し，**{n_fixed} 小問を修正**，1 小問（A-COM-510 (2)）は修正不要と判断。',
     '- 人手確認 13 小問：すべて「要人手確認」のまま（AI だけで解決済みにしていない）。', '',
     '| 問題 | 小問 | 監査の分類 | 照合結果と判断 | 修正 | 別エージェントの再検証 |', '|---|---|---|---|---|---|']
for r in rows:
    R.append(f"| {r['problem_id']} | {r['subproblem']} | {r['original_category']} | {r['modification_status']} | {r['modification_summary'][:120].replace('|','／')} | {r['independent_recheck'][:160].replace('|','／')} |")
R += ['', '## 2. 指示書の解釈', '',
      '- 第3節（修正する）と第4節（人手確認の13小問は自動的に修正しない）で9小問が重なる。第3節が III-DIF-374 などを明示的に「修正する」としているので，「AI の判断だけで解決済みにしない」と解釈した：修正案は PR に入れるが，人手確認は「はい」のまま残し，状態は「修正済み・人手確認待ち」とした。第3節にない II-TRI-190・III-DIF-356 は変更していない。',
      '- B-SEQ-342 の補助数列は，指示書の例 $c_n$ ではなく $d_n$ にした（解説で定数 $c$ が使われているため）。', '',
      '## 3. 問題文・出題意図に関する懸念', '',
      '- C-CUR-459 (1)：「2つの焦点」を相異なる2点と読み，円を除いた。円を含める読み方では答えが変わる（$0<s\\leqq\\frac13$）。問題文に「（円を除く）」などと明記するかは人が判断する（問題文は変更していない）。',
      '- III-DIF-356 (2)：3重根の型（無理数係数）の2つを含めるか。',
      '- III-DIF-380 (2)：問題文は「解がちょうど2個であるとき」と前提を置いているので，前提つきの答え「$ab<e$」も問題文の読み方としては成り立つ。答えには両方の形を書いた。', '',
      '## 4. 変更したファイル', '',
      '- `content/problems/{III-16,A-06,C-19,II-09,B-13,II-12}.json`：対象9問の答え（III-DIF-380 のみ）・解説・着想',
      '- `data/*.json`（24ファイル）：`tools/build_app_data.py` で再生成。中身が変わったのは対象9問の s・k・a と，内容から計算される `dataVersion`（キャッシュの版）だけ',
      '- `docs/audit/2026-11-25/explanation-remediation/`：この記録', '',
      '## 5. 既存データへの影響', '',
      '- 問題ID・問題文・タグ・難易度・品質データ（`quality`，`content/quality/`）は変更していない（下の検査）。',
      '- 学習履歴・ブックマークは問題IDで結びつくので影響しない。`dataVersion` の変化はアプリが古いデータのキャッシュを捨てるためのもの。',
      '- 管理表（xlsx）はリポジトリにないので反映していない。**`before_after.md` の内容を管理表に入れる必要がある。**', '',
      '## 6. 検査', '', '| チェック | 結果 |', '|---|---|']
R += [f'| {k} | {"OK" if v else "NG"} |' for k, v in checks.items()]
R += ['', '- テスト一式（`node tests/run.mjs`）：修正前後で同じ結果（`tests_before.txt`・`tests_after.txt`）。失敗1件「サーバー側の書き込み制限」は，この環境に @electric-sql/pglite が入っていないためで，修正前から同じ。']
R += [f'- 注意：{x}' for x in notes]
R += ['', '## 7. ファイル', '', '- `remediation_results.csv`：小問ごとの結果（修正対象12＋人手確認のみ4＝16行）',
      '- `human_review_required.md`：人手確認13小問の記録（7項目）', '- `before_after.md`：修正前後の差分と，管理表に貼る修正後の全文',
      '- `apply_fixes.py`：修正の適用（修正前・修正後の文を保持。`--check` で適用状態を確認）', '- `audit_snapshot.csv`：解説監査（PR #2，`500b033`）の対象行の写し',
      '- `recheck/`：修正していない別エージェントによる再検証', '- `build.py`：このファイル群を生成するスクリプト']
open(f'{D}/remediation_report.md', 'w', encoding='utf-8').write('\n'.join(R) + '\n')
print(json.dumps({'ok': all(checks.values()), 'failed': [k for k, v in checks.items() if not v], 'rows': len(rows), 'fixed': n_fixed, 'notes': notes}, ensure_ascii=False))
sys.exit(0 if all(checks.values()) else 1)
