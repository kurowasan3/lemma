#!/usr/bin/env python3
"""人手レビュー資料（13小問）を作る。

    python3 docs/audit/2026-11-25/human-review/verify.py   # 先に検算（verify_results.json）
    python3 docs/audit/2026-11-25/human-review/build.py    # 資料を作り，自己点検する

- 問題文・答え・解説・着想は content/problems/*.json（PR #3 の内容）から，修正前は main（c3193af）から機械的に埋め込む。手で写さない。
- 監査の記録は既存の CSV から埋め込む。既存の記録は読むだけで書き換えない。
- 手書きの部分（C の注記，D，E）は review_notes.py にある。
- 判定欄はすべて空欄（未チェック）で出力する。AI が判定を書き込むことはない。
"""
import csv, difflib, io, json, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / 'final-validation'))
import review_notes as RN
import symbol_replace as SR

MAIN = 'c3193afacdceeece990b9c4ef99046f9b94b0285'          # main（修正前）
PR3 = '90c0794b741a80601ec05d042f15ba69bff8acca'           # PR #3 head（修正後）
PR4 = 'f746e69205d153cba703a89f65587e73f7b4fcb3'           # PR #4 head（この資料の土台）
AUDIT = '500b033'                                          # 解説監査（PR #2）
FROZEN = 'f4f6db86'                                        # 独立解の凍結
AGG = '71c8a7d'                                            # 集計（PR #1）

def git(*a): return subprocess.check_output(['git', *a], cwd=ROOT, text=True)
def git_csv(rev, path): return list(csv.DictReader(io.StringIO(git('show', f'{rev}:{path}'))))
def sub_key(r): return (r['problem_id'] if 'problem_id' in r else r['id'], r['subproblem'])

# ---------------------------------------------------------------- 入力
def find_problem(pid, rev=None):
    files = sorted((ROOT / 'content/problems').glob('*.json'))
    for f in files:
        rel = f.relative_to(ROOT).as_posix()
        items = json.loads(git('show', f'{rev}:{rel}')) if rev else json.loads(f.read_text(encoding='utf-8'))
        for p in items:
            if p['id'] == pid: return rel, p
    raise KeyError(pid)
def fields(p):
    return {'statement': p['statement']['tex'], 'answer': p['answer']['tex'],
            'solution': p['solutions'][0]['tex'], 'idea': p['idea']['tex']}

PIDS = list(dict.fromkeys(pid for pid, _ in RN.TARGETS))
CUR, OLD, PR3C, FILE = {}, {}, {}, {}
for pid in PIDS:
    FILE[pid], p = find_problem(pid); CUR[pid] = fields(p)
    assert len(p['solutions']) == 1, pid
    OLD[pid] = fields(find_problem(pid, MAIN)[1])
    PR3C[pid] = fields(find_problem(pid, PR3)[1])

REM = {sub_key(r): r for r in csv.DictReader(open(HERE.parent / 'explanation-remediation/remediation_results.csv', encoding='utf-8'))}
EXP = {sub_key(r): r for r in git_csv(AUDIT, 'docs/audit/2026-11-25/explanation-audit/explanation_results.csv')}
AGGR = {sub_key(r): r for r in git_csv(AGG, 'docs/audit/2026-11-25/aggregate-254/subproblem_summary.csv')}
VER = json.loads((HERE / 'verify_results.json').read_text(encoding='utf-8'))
FROZEN_MD = git('show', f'{FROZEN}:docs/audit/2026-11-25/explanation-audit/independent_solutions.md')

def frozen_section(pid, sub):
    m = re.search(rf'^## {re.escape(pid)}\n(.*?)(?=^## )', FROZEN_MD, re.S | re.M)
    if not m: return None
    s = re.search(rf'^### {re.escape(sub)}\n(.*?)(?=^### |\Z)', m.group(1), re.S | re.M)
    if not s: return None
    ans = re.search(r'^- 最終答案:(.*?)(?=^- )', s.group(1), re.M | re.S)
    unp = re.search(r'^- 未証明の点: (.*)$', s.group(1), re.M)
    conf = re.search(r'^- 確信度: (.*)$', s.group(1), re.M)
    clean = lambda t: re.sub(r'\s*\n\s*(- )?', ' ', re.sub(r'^- ', '', t.strip()))
    return {k: (clean(v.group(1)) if v else '') for k, v in [('answer', ans), ('unproven', unp), ('confidence', conf)]}

# ---------------------------------------------------------------- 変更の確認
FIELD_JA = {'statement': '問題文', 'answer': '答え', 'solution': '解説', 'idea': '着想'}
def changed_fields(pid): return [k for k in FIELD_JA if CUR[pid][k] != OLD[pid][k]]
def para_diff(old, new):
    o, n = old.split('\n'), new.split('\n'); out = []
    for tag, a1, a2, b1, b2 in difflib.SequenceMatcher(None, o, n, autojunk=False).get_opcodes():
        if tag != 'equal': out.append(('\n'.join(o[a1:a2]), '\n'.join(n[b1:b2])))
    return out
SEQ_CHECK = {}
for k in ('solution', 'idea'):
    renamed = SR.rename_subscripted(OLD['B-SEQ-342'][k], 'b', 'd')
    renamed = renamed[0] if isinstance(renamed, tuple) else renamed
    ok, positions = SR.changed_only_at(OLD['B-SEQ-342'][k], CUR['B-SEQ-342'][k])
    SEQ_CHECK[k] = {'rename_equal': renamed == CUR['B-SEQ-342'][k], 'only_at': ok, 'n': len(positions),
                    'b_left': len(re.findall(r'(?<![A-Za-z\\])b_', CUR['B-SEQ-342'][k]))}

# ---------------------------------------------------------------- 部品
def tex(s): return '```tex\n' + s.rstrip('\n') + '\n```\n'
def anchor(pid, sub): return f'{pid}-{sub.strip("()")}'.lower()
def fmt_cat(c): return c if c else '（記録なし）'
DECISION_BOX = ['承認', '修正を要求', '保留・追加検証']
def decision_block(pid, sub):
    return ('\n'.join(f'- [ ] {d}' for d in DECISION_BOX) +
            '\n\n判定理由：\n\n> （未記入）\n\n必要な修正（「修正を要求」のとき）：\n\n> （未記入）\n\n'
            '審査者：（未記入）　審査日：（未記入）\n')

def section_A(pid):
    return f'問題ファイル：`{FILE[pid]}`（問題文は PR #3・main とも同じで，変更されていない）\n\n' + tex(CUR[pid]['statement'])
def section_B(pid):
    ch = changed_fields(pid); out = []
    if not ch: out.append('**PR #3 での変更：なし**（答え・解説・着想とも main と同じ）。\n')
    else: out.append('**PR #3 での変更：' + '・'.join(FIELD_JA[k] for k in ch) + '**（下に修正前・修正後を示す）。\n')
    out.append('#### 答え（現在）\n' + tex(CUR[pid]['answer']))
    out.append('<details><summary>解説（現在，全文）</summary>\n\n' + tex(CUR[pid]['solution']) + '\n</details>\n')
    out.append('#### 着想（現在）\n' + tex(CUR[pid]['idea']))
    if pid == 'B-SEQ-342':
        s, i = SEQ_CHECK['solution'], SEQ_CHECK['idea']
        out.append('#### 修正前と修正後の違い\n'
                   f'解説・着想の補助数列の記号を $b_n$ から $d_n$ に付け替えただけ（解説 {s["n"]} 箇所，着想 {i["n"]} 箇所）。'
                   '差分が長いので全文は示さない。build.py による機械照合：\n\n'
                   f'- 修正前の文に「命令名の外の `b_` を `d_` にする」付け替えを施した結果が，修正後と完全に一致する：解説 {"一致" if s["rename_equal"] else "**不一致**"}，着想 {"一致" if i["rename_equal"] else "**不一致**"}\n'
                   f'- 違いはその位置だけ：解説 {"はい" if s["only_at"] else "**いいえ**"}，着想 {"はい" if i["only_at"] else "**いいえ**"}\n'
                   f'- 修正後に残る `b_`（命令名の外）：解説 {s["b_left"]} 箇所，着想 {i["b_left"]} 箇所\n'
                   '- 修正前の全文は `git show ' + MAIN[:7] + ':' + FILE[pid] + '` で見られる。\n')
    else:
        for k in ch:
            for o, n in para_diff(OLD[pid][k], CUR[pid][k]):
                out.append(f'#### {FIELD_JA[k]}：修正前（main {MAIN[:7]}）\n' + tex(o or '（なし）') +
                           f'#### {FIELD_JA[k]}：修正後（PR #3 {PR3[:7]}）\n' + tex(n or '（なし）'))
    return '\n'.join(out)
def section_C(pid, sub):
    r, e, a = REM[(pid, sub)], EXP[(pid, sub)], AGGR.get((pid, sub), {})
    rows = [('第一段階（解答照合，集計）', fmt_cat(a.get('category')), a.get('notes', '')),
            ('解説監査 第1パス', fmt_cat(e['first_pass_category']), ''),
            ('解説監査 第2パス（敵対的）', fmt_cat(e['second_pass_category']), e.get('second_pass_weakest_point', '')),
            ('解説監査 最終分類', fmt_cat(e['explanation_category']), f'根拠：{e["category_basis"]}。' + e['issue_description']),
            ('修正段階 原本照合', r['modification_status'], r['verification_result']),
            ('修正段階 修正内容', '', r['modification_summary']),
            ('修正段階 別エージェントの再検証', '', r['independent_recheck']),
            ('残る点', '', r['remaining_issue'] or 'なし')]
    t = '| 段階 | 判定 | 内容 |\n|---|---|---|\n' + ''.join(
        f'| {s} | {c} | {x.replace("|", "｜").replace(chr(10), " ")} |\n' for s, c, x in rows)
    t += f'\n人手確認の理由（記録）：{r["audit_human_review_reason"] or e["human_review_reason"]}\n'
    if (pid, sub) in RN.C_NOTE: t += f'\n**注記（この資料で追加）：** {RN.C_NOTE[(pid, sub)]}\n'
    return t
def section_D(pid, sub):
    out = ['> この節は資料を作った AI が書いた。保存済み解説と過去の記録を読んだうえで書いているので，'
           '保存済み解説から独立に作った解答ではない。計算は省略せずに書いたので，各段を人が追って確かめること。\n',
           RN.D[(pid, sub)].strip() + '\n', '**機械による検算の結果（verify_results.json）**\n']
    for k in RN.VERIFY_KEYS[(pid, sub)]:
        v = VER[k]; out.append(f'- {"✓" if v["ok"] else "✗"} `{k}`（{v["kind"]}）：{v["detail"]}')
    fz = frozen_section(pid, sub)
    if fz:
        out.append(f'\n**凍結された独立解（{FROZEN}，保存済み解説を見る前に作成）**：最終答案「{fz["answer"]}」，未証明の点「{fz["unproven"]}」，確信度「{fz["confidence"]}」')
    return '\n'.join(out) + '\n'
def section_E(pid, sub):
    e = RN.E[(pid, sub)]
    return ('**数学的な誤りがないかの確認（正誤の問題）**\n\n' + '\n'.join(f'- {x}' for x in e['math']) +
            '\n\n**出題意図・表記・書き方の判断（正誤ではなく選択の問題）**\n\n' + '\n'.join(f'- {x}' for x in e['intent']) + '\n')

# ---------------------------------------------------------------- 出力
def build_guide():
    L = ['# 人手レビューの手引き：PR #3 の13小問', '',
         '人による審査のための資料。**この資料は審査の結果ではない。** 13小問はすべて「未審査」で，判定欄（F）はすべて空欄である。', '',
         '## 前提', '',
         f'- 審査の対象は PR #3（`fix/explanation-remediation-2026-11-25`，{PR3[:7]}）の登録内容。PR #4（{PR4[:7]}）は管理表の同期と検証で，登録内容は PR #3 と同じ。',
         f'- 修正前は main（{MAIN[:7]}）。この資料のブランチは PR #4 の上に作り，資料（このフォルダ）以外は何も変えていない。',
         '- 問題文・答え・解説・着想は JSON から機械的に埋め込んだ（手で写していない）。アプリでの表示と照らすときは同じ TeX ソースを見ればよい。',
         '- D（独立した数学的検証）は資料を作った AI が書いたもので，保存済み解説を読んだあとに書いている。'
         f'保存済み解説を見る前に凍結された独立解（{FROZEN}）があるものは併記した。機械による検算（verify.py）は判断の補助で，証明の代わりではない。'
         '有限の範囲の確認は，その外について何も保証しない。', '',
         '## 審査の進め方', '',
         '1. A（問題文）と B（現在の登録内容，修正があれば修正前・修正後）を読む。',
         '2. C（監査で何が指摘されたか）を読み，論点をつかむ。',
         '3. D の計算を自分で追う。省略している段があれば，それ自体を指摘してよい。',
         '4. E は「数学的な誤り」と「出題意図・表記の選択」に分けてある。前者は正誤，後者は方針の判断。',
         '5. F に判定を書く。チェックは1つだけ付ける。「修正を要求」のときは必要な修正を書く。',
         '6. 結果は `human_review_checklist.md` にも写す（索引は `review_index.md`）。', '',
         '判定の意味：**承認**＝現在の登録内容（PR #3）のままでよい／**修正を要求**＝登録内容を直す必要がある（直す内容を書く）／**保留・追加検証**＝この資料だけでは決められない。', '',
         '## 目次', '']
    for pid, sub in RN.TARGETS: L.append(f'- [{pid} {sub}](#{anchor(pid, sub)})　{RN.KIND[(pid, sub)]}')
    L.append('')
    seen = set()
    for pid, sub in RN.TARGETS:
        L += [f'<a id="{anchor(pid, sub)}"></a>', f'## {pid} {sub}', '', f'重点：{RN.FOCUS[pid]}', '']
        if pid in seen:
            first = next(s for p, s in RN.TARGETS if p == pid)
            L += ['### A. 問題の原文', '', f'[{pid} {first}](#{anchor(pid, first)}) と同じ。', '',
                  '### B. 現在の登録内容', '', f'[{pid} {first}](#{anchor(pid, first)}) と同じ（答え・解説・着想は問題単位で1つ）。', '']
        else:
            L += ['### A. 問題の原文', '', section_A(pid), '### B. 現在の登録内容', '', section_B(pid)]
        seen.add(pid)
        L += ['### C. AI 監査での指摘', '', section_C(pid, sub), '### D. 独立した数学的検証', '', section_D(pid, sub),
              '### E. 人間が判断する論点', '', section_E(pid, sub), '### F. 最終判定欄', '', decision_block(pid, sub), '---', '']
    return '\n'.join(L)

def build_checklist():
    L = ['# 人手レビュー チェックリスト（13小問）', '',
         '審査者が記入する。**AI は記入しない。** 詳しい資料は `human_review_guide.md`。', '',
         '## 進み具合', '', '| 小問 | 状態 |', '|---|---|']
    for pid, sub in RN.TARGETS: L.append(f'| {pid} {sub} | 未審査 |')
    L += ['', '## 小問ごとの記入欄', '']
    for pid, sub in RN.TARGETS:
        e = RN.E[(pid, sub)]
        L += [f'### {pid} {sub}', '', f'論点の種類：{RN.KIND[(pid, sub)]}。PR #3 での変更：' +
              ('・'.join(FIELD_JA[k] for k in changed_fields(pid)) or 'なし') + f'。詳細は guide の [{pid} {sub}](human_review_guide.md#{anchor(pid, sub)})。', '',
              '確認項目：', '']
        L += [f'- [ ] {x}' for x in e['math']] + [f'- [ ] （方針）{x}' for x in e['intent']]
        L += ['', '判定：', '', decision_block(pid, sub)]
    L += ['## 審査がすべて終わったら', '',
          '- 13小問すべてに判定が1つずつ付いていること。',
          '- 「修正を要求」があれば，PR #3 に修正を加えるかどうかを決める（この資料のブランチでは修正しない）。',
          '- PR #3 をマージする前に，管理表を同期済みのファイル（PR #4 の記録を参照）に差し替えること。', '']
    return '\n'.join(L)

def build_index():
    L = ['# 人手レビュー資料の索引', '',
         '| 小問 | 問題ファイル | 論点の種類 | 第一段階 | 解説監査（第1／第2／最終） | PR #3 での変更 | 機械検算 | 状態 |',
         '|---|---|---|---|---|---|---|---|']
    for pid, sub in RN.TARGETS:
        e, a = EXP[(pid, sub)], AGGR.get((pid, sub), {})
        ok = all(VER[k]['ok'] for k in RN.VERIFY_KEYS[(pid, sub)])
        L.append(f'| [{pid} {sub}](human_review_guide.md#{anchor(pid, sub)}) | `{FILE[pid]}` | {RN.KIND[(pid, sub)]} | {a.get("category", "")} | '
                 f'{e["first_pass_category"]}／{e["second_pass_category"]}／{e["explanation_category"]} | '
                 f'{"・".join(FIELD_JA[k] for k in changed_fields(pid)) or "なし"} | {"✓" if ok else "✗"} | 未審査 |')
    L += ['', '## このフォルダのファイル', '',
          '| ファイル | 内容 |', '|---|---|',
          '| `human_review_guide.md` | 13小問それぞれの A〜F（問題文，登録内容と修正前後，監査の指摘，独立した検証，判断の論点，判定欄） |',
          '| `human_review_checklist.md` | 審査者が記入するチェックリスト |',
          '| `review_index.md` | この索引 |',
          '| `review_notes.py` | 手書き部分（C の注記，D，E） |',
          '| `verify.py` / `verify_results.json` | 機械による検算とその結果 |',
          '| `build.py` | 資料の生成と自己点検 |', '',
          '## 参照した記録（読むだけで変更していない）', '',
          f'- 第一段階の集計：`{AGG}:docs/audit/2026-11-25/aggregate-254/subproblem_summary.csv`',
          f'- 解説監査：`{AUDIT}:docs/audit/2026-11-25/explanation-audit/explanation_results.csv`',
          f'- 凍結された独立解：`{FROZEN}:docs/audit/2026-11-25/explanation-audit/independent_solutions.md`',
          '- 修正段階：`docs/audit/2026-11-25/explanation-remediation/remediation_results.csv`，`human_review_required.md`，`before_after.md`',
          '- 最終検証：`docs/audit/2026-11-25/final-validation/human_review_status.md`（13小問すべて「確認待ち」のまま）', '',
          '## 記録の食い違い（この資料で気づいたもの）', '',
          '- II-TRI-190 (1)：`human_review_required.md` は「第一段階でD」と書くが，集計では (1) は B（人手確認「いいえ」）で，D は (2)(3)。問題単位の D により (1) も対象になったものと考えられる。既存の記録は書き換えていない。', '']
    return '\n'.join(L)

# ---------------------------------------------------------------- 自己点検
def checks(guide, checklist, index):
    errs = []
    want = set(RN.TARGETS)
    rem = {k for k, r in REM.items() if r['human_review_required'] == 'はい'}
    if rem != want: errs.append(f'対象が remediation_results と違う：{rem ^ want}')
    exp = {k for k, r in EXP.items() if r['human_review_required'] == 'はい'}
    if exp != want: errs.append(f'対象が explanation_results と違う：{exp ^ want}')
    for pid in PIDS:
        if CUR[pid] != PR3C[pid]: errs.append(f'{pid}：作業ツリーの内容が PR #3 と違う')
        if CUR[pid]['statement'] != OLD[pid]['statement']: errs.append(f'{pid}：問題文が main と違う')
        if CUR[pid]['statement'] not in guide: errs.append(f'{pid}：問題文が guide にそのまま入っていない')
        if CUR[pid]['answer'] not in guide: errs.append(f'{pid}：答えが guide にそのまま入っていない')
        if CUR[pid]['solution'] not in guide: errs.append(f'{pid}：解説が guide にそのまま入っていない')
    expect_changed = {'II-TRI-190': [], 'III-DIF-356': [], 'A-COM-510': [], 'III-DIF-374': ['solution', 'idea'],
                      'B-SEQ-342': ['solution', 'idea'], 'C-CUR-459': ['solution'], 'II-GEO-300': ['solution'],
                      'III-DIF-359': ['solution'], 'III-DIF-380': ['answer', 'solution']}
    for pid, ex in expect_changed.items():
        if changed_fields(pid) != ex: errs.append(f'{pid}：変更された欄が想定と違う {changed_fields(pid)}')
    for k, v in SEQ_CHECK.items():
        if not (v['rename_equal'] and v['only_at'] and v['b_left'] == 0): errs.append(f'B-SEQ-342 {k}：付け替えの照合に失敗 {v}')
    for pid, sub in RN.TARGETS:
        a = anchor(pid, sub)
        block = guide.split(f'<a id="{a}"></a>')[1].split('\n---\n')[0]
        for h in ['### A.', '### B.', '### C.', '### D.', '### E.', '### F.']:
            if h not in block: errs.append(f'{pid} {sub}：{h} がない')
        if block.count('- [ ] ') != 3: errs.append(f'{pid} {sub}：判定欄が3つでない')
        if f'| {pid} {sub} | 未審査 |' not in checklist: errs.append(f'{pid} {sub}：チェックリストの状態が未審査でない')
        if f'[{pid} {sub}]' not in index: errs.append(f'{pid} {sub}：索引にない')
    for name, text in [('guide', guide), ('checklist', checklist), ('index', index)]:
        if re.search(r'- \[[xX]\]', text): errs.append(f'{name}：チェック済みの欄がある')
        if re.search(r'承認済み|審査済み|確認済み（人）', text): errs.append(f'{name}：審査済みを示す語がある')
    if not all(v['ok'] for v in VER.values()): errs.append('verify_results に ✗ がある')
    # 資料フォルダ以外に変更がないこと（PR #4 の head と比べる。未追跡ファイルも含む）
    diff = [l for l in git('diff', '--name-only', PR4).splitlines() if not l.startswith('docs/audit/2026-11-25/human-review/')]
    untracked = [l[3:] for l in git('status', '--porcelain', '--untracked-files=all').splitlines()
                 if not l[3:].startswith('docs/audit/2026-11-25/human-review/')]
    if diff or untracked: errs.append(f'資料フォルダ以外の変更：{diff + untracked}')
    return errs

if __name__ == '__main__':
    g, c, i = build_guide(), build_checklist(), build_index()
    for name, text in [('human_review_guide.md', g), ('human_review_checklist.md', c), ('review_index.md', i)]:
        (HERE / name).write_text(text, encoding='utf-8')
    errs = checks(g, c, i)
    print(f'小問 {len(RN.TARGETS)}，問題 {len(PIDS)}，guide {len(g)} 字')
    for e in errs: print('✗', e)
    print('自己点検：' + ('すべて通過' if not errs else f'{len(errs)} 件の問題'))
    sys.exit(1 if errs else 0)
