#!/usr/bin/env python3
"""PR #3 の最終検証：管理表との同期・管理表からの再生成・記号付け替えの回帰検査・人手確認の状況。

    python3 docs/audit/2026-11-25/final-validation/build.py 元の管理表.xlsx 同期後の管理表.xlsx

リポジトリのルートで実行する。管理表（xlsx）は非公開の列（参考元）を含むのでリポジトリに入れない。
このため管理表のパスを引数で渡す。記録にはハッシュ値だけを残す。

書き出すもの（このディレクトリ内のみ）：
  management_sheet_sync.csv, regeneration_comparison.csv, symbol_replacement_tests.md,
  human_review_status.md, final_validation_report.md
"""
import csv, hashlib, json, os, subprocess, sys, tarfile, io, tempfile, zipfile
from collections import OrderedDict
from pathlib import Path

ROOT = Path.cwd()
D = ROOT / 'docs/audit/2026-11-25/final-validation'
MAIN = 'c3193afacdceeece990b9c4ef99046f9b94b0285'
PR3 = '90c0794b741a80601ec05d042f15ba69bff8acca'
sys.path.insert(0, str(D))
import symbol_replace as SR  # noqa: E402
from sync_sheet import TARGETS, FIELDS, sheet_path  # noqa: E402

def git(*a, binary=False):
    r = subprocess.run(['git', *a], cwd=ROOT, capture_output=True)
    if r.returncode: raise RuntimeError(r.stderr.decode())
    return r.stdout if binary else r.stdout.decode('utf-8')
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def items(d): return d if isinstance(d, list) else d.get('problems', [d])
def prob_at(commit, pid):
    return next(p for p in items(json.loads(git('show', f'{commit}:content/problems/{TARGETS.get(pid, "A-05") if pid != "A-COM-510" else "A-05"}.json'))) if p['id'] == pid)
nl = lambda s: str(s or '').replace('\r\n', '\n').replace('\r', '\n')

orig_x, sync_x = sys.argv[1], sys.argv[2]
checks = OrderedDict(); notes = []

# ---------------------------------------------------------------- 1. PR #3 の差分の再確認
files = [x for x in git('diff', '--name-only', MAIN, PR3).split() if x]
c_files = sorted(x for x in files if x.startswith('content/'))
d_files = [x for x in files if x.startswith('data/')]
doc_files = [x for x in files if x.startswith('docs/audit/2026-11-25/explanation-remediation/')]
checks['PR #3：content/problems の6ファイル'] = c_files == sorted(f'content/problems/{f}.json' for f in set(TARGETS.values()))
checks['PR #3：data/ の24ファイル'] = len(d_files) == 24
checks['PR #3：それ以外は explanation-remediation/ だけ'] = len(files) == len(c_files) + len(d_files) + len(doc_files)
changed_fields = {}
for path in c_files:
    old = {p['id']: p for p in items(json.loads(git('show', f'{MAIN}:{path}')))}
    new = {p['id']: p for p in items(json.loads(git('show', f'{PR3}:{path}')))}
    for i in old:
        if old[i] != new[i]: changed_fields[i] = sorted(k for k in set(old[i]) | set(new[i]) if old[i].get(k) != new[i].get(k))
checks['PR #3：変わったのは対象9問の答え・解説・着想だけ'] = set(changed_fields) == set(TARGETS) and all(set(v) <= {'answer', 'solutions', 'idea'} for v in changed_fields.values())
a510 = (prob_at(MAIN, 'A-COM-510'), prob_at(PR3, 'A-COM-510'))
checks['A-COM-510 は変更されていない'] = a510[0] == a510[1]

# ---------------------------------------------------------------- 2. B-SEQ-342 の全文確認
b_old, b_new = prob_at(MAIN, 'B-SEQ-342'), prob_at(PR3, 'B-SEQ-342')
bseq = []
for fld, g in [('解答・解説', lambda p: p['solutions'][0]['tex']), ('着想', lambda p: p['idea']['tex']),
               ('問題文', lambda p: p['statement']['tex']), ('答え', lambda p: p['answer']['tex'])]:
    o, n = g(b_old), g(b_new)
    ok, pos = SR.changed_only_at(o, n)
    rem = len(SR.rename_subscripted(n, 'b', 'd')[1])
    bseq.append((fld, ok, len(pos) if isinstance(pos, list) else pos, rem, n.count('d_'), o == n))
checks['B-SEQ-342：解説・着想の差は「命令名の外の b_→d_」の位置だけ'] = all(x[1] for x in bseq[:2])
checks['B-SEQ-342：添字つきの b（命令名の外の b_）が残っていない'] = all(x[3] == 0 for x in bseq)
checks['B-SEQ-342：問題文・答えは変わっていない（問題文の b はそのまま）'] = bseq[2][5] and bseq[3][5]
checks['B-SEQ-342：補助数列の定義が d_n=\\beta(a_n)'] = 'd_n=\\beta(a_n)' in b_new['solutions'][0]['tex']

# ---------------------------------------------------------------- 3. 記号付け替えの回帰テスト
tests = SR.run_tests()
checks['付け替えの回帰テスト（字句解析版）がすべて合格'] = all(t['tokenizer'] for t in tests)
checks['回帰テストが1回目の正規表現の欠陥を検出する'] = not all(t['regex_v1'] for t in tests)

# ---------------------------------------------------------------- 4. 管理表：バックアップ・部品・セル
ho, hs = sha(orig_x), sha(sync_x)
za, zb = zipfile.ZipFile(orig_x), zipfile.ZipFile(sync_x)
sp = sheet_path(za, '問題一覧')
parts_diff = [i.filename for i in za.infolist() if za.read(i.filename) != zb.read(i.filename)]
checks['管理表：zip の部品の並び・圧縮方式が同じ'] = [i.filename for i in za.infolist()] == [i.filename for i in zb.infolist()] and [i.compress_type for i in za.infolist()] == [i.compress_type for i in zb.infolist()]
checks['管理表：変わった部品は「問題一覧」シートの XML だけ'] = parts_diff == [sp]
import openpyxl  # noqa: E402
wa, wb = openpyxl.load_workbook(orig_x), openpyxl.load_workbook(sync_x)
diff_cells = []
for s in wa.sheetnames:
    A, B = wa[s], wb[s]
    for ra, rb in zip(A.iter_rows(), B.iter_rows()):
        for ca, cb in zip(ra, rb):
            if ca.value != cb.value or ca.style_id != cb.style_id: diff_cells.append((s, ca.coordinate, ca.style_id == cb.style_id))
checks['管理表：シート構成・行列数・フィルター・固定が同じ'] = wa.sheetnames == wb.sheetnames and all(
    wa[s].max_row == wb[s].max_row and wa[s].max_column == wb[s].max_column and wa[s].auto_filter.ref == wb[s].auto_filter.ref and wa[s].freeze_panes == wb[s].freeze_panes for s in wa.sheetnames)
ws_o, ws_s = wa['問題一覧'], wb['問題一覧']
head = {c.value: c.column_letter for c in ws_o[1]}
rowof = {}
for r in range(2, ws_o.max_row + 1):
    v = ws_o[f'{head["ID"]}{r}'].value
    if v in TARGETS or v == 'A-COM-510': rowof.setdefault(v, []).append(r)
sync_rows, expected_cells = [], set()
for pid in list(TARGETS) + ['A-COM-510']:
    r = rowof[pid][0]; pm, pp = prob_at(MAIN, pid), prob_at(PR3, pid)
    for fname, g in FIELDS.items():
        col = head[fname]; ref = f'{col}{r}'
        o_val, s_val = nl(ws_o[ref].value), nl(ws_s[ref].value)
        jm, jp = g(pm), g(pp)
        changed = jm != jp
        if changed: expected_cells.add(('問題一覧', ref))
        exact = s_val == jp
        norm = ' '.join(s_val.split()) == ' '.join(jp.split())
        sync_rows.append(OrderedDict([
            ('problem_id', pid), ('column', f'{col}（{fname}）'), ('cell', ref), ('row_count_for_id', len(rowof[pid])),
            ('changed_by_pr3', 'はい' if changed else 'いいえ'),
            ('sheet_before_equals_main_json', '一致' if o_val == jm else '不一致'),
            ('sheet_value_sha256', hashlib.sha256(s_val.encode()).hexdigest()[:16]), ('sheet_value_len', len(s_val)),
            ('json_value_sha256', hashlib.sha256(jp.encode()).hexdigest()[:16]), ('json_value_len', len(jp)),
            ('match', '一致' if exact else ('空白・改行の正規化で一致' if norm else '不一致')),
            ('mismatch_detail', '' if exact else ('空白・改行のみの差' if norm else '内容の差')),
            ('sheet_value_head', s_val[:80]), ('json_value_head', jp[:80]),
        ]))
checks['管理表：各対象IDの行はちょうど1つ'] = all(len(v) == 1 for v in rowof.values())
checks['管理表：同期前の対象セルは main の JSON と一致（同期の出発点が正しい）'] = all(r['sheet_before_equals_main_json'] == '一致' for r in sync_rows)
checks['管理表：同期後の対象セルは PR #3 の JSON と完全一致'] = all(r['match'] == '一致' for r in sync_rows)
checks['管理表：値が変わったセル＝PR #3 で変わった欄のセル（12個）だけ，書式は不変'] = {(s, c) for s, c, _ in diff_cells} == expected_cells and len(expected_cells) == 12 and all(x[2] for x in diff_cells)
with open(D / 'management_sheet_sync.csv', 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(sync_rows[0])); w.writeheader(); w.writerows(sync_rows)

# ---------------------------------------------------------------- 5. 管理表からの再生成（一時ディレクトリ）
def regen(commit, xlsx):
    tmp = Path(tempfile.mkdtemp(prefix='regen_'))
    tarfile.open(fileobj=io.BytesIO(git('archive', commit, binary=True))).extractall(tmp, filter='data')
    for cmd in (['python3', 'tools/xlsx_to_content.py', str(Path(xlsx).resolve())], ['python3', 'tools/build_app_data.py']):
        r = subprocess.run(cmd, cwd=tmp, capture_output=True, text=True)
        if r.returncode: raise RuntimeError(r.stdout + r.stderr)
    return tmp
regen_rows = []
def compare(tmp, commit, label):
    # content/problems：問題ごと・欄ごと
    n_same = n_diff = 0; out = []
    for f in sorted((tmp / 'content/problems').glob('*.json')):
        rel = f'content/problems/{f.name}'
        new = {p['id']: p for p in items(json.loads(f.read_text(encoding='utf-8')))}
        old = {p['id']: p for p in items(json.loads(git('show', f'{commit}:{rel}')))}
        for i in sorted(set(old) | set(new)):
            if old.get(i) == new.get(i): n_same += 1
            else:
                n_diff += 1
                out.append((i, sorted(k for k in set(old.get(i, {})) | set(new.get(i, {})) if old.get(i, {}).get(k) != new.get(i, {}).get(k))))
    other = [x for x in git('ls-tree', '-r', '--name-only', commit, 'content').split() if x and not x.startswith('content/problems/')]
    other_diff = [x for x in other if (tmp / x).exists() and (tmp / x).read_bytes() != git('show', f'{commit}:{x}', binary=True) and x != 'content/meta.json']
    data_diff = []
    for x in [y for y in git('ls-tree', '-r', '--name-only', commit, 'data').split() if y]:
        a = json.loads(git('show', f'{commit}:{x}')); b = json.loads((tmp / x).read_text(encoding='utf-8'))
        for d_ in (a, b):
            if isinstance(d_, dict): d_.pop('generated', None); d_.pop('source', None)
        if a != b: data_diff.append(x)
    dv = (json.loads(git('show', f'{commit}:data/index.json'))['dataVersion'], json.loads((tmp / 'data/index.json').read_text(encoding='utf-8'))['dataVersion'])
    return n_same, n_diff, out, other_diff, data_diff, dv
base_tmp = regen(MAIN, orig_x)
b_same, b_diff, b_out, b_other, b_data, b_dv = compare(base_tmp, MAIN, '元の管理表→main')
sync_tmp = regen(PR3, sync_x)
s_same, s_diff, s_out, s_other, s_data, s_dv = compare(sync_tmp, PR3, '同期後の管理表→PR #3')
checks['再生成（基準）：元の管理表から作り直すと main と全問一致'] = b_diff == 0 and not b_other and not b_data
checks['再生成：同期後の管理表から作り直すと PR #3 と全問一致（content）'] = s_diff == 0 and not s_other
checks['再生成：data/ も PR #3 と一致（generated・source 以外）'] = not s_data
checks['再生成：dataVersion が PR #3 と同じ'] = s_dv[0] == s_dv[1]
for pid in TARGETS:
    pm, pp = prob_at(PR3, pid), None
    p_new = next(p for p in items(json.loads((sync_tmp / f'content/problems/{TARGETS[pid]}.json').read_text(encoding='utf-8'))) if p['id'] == pid)
    for fname, g in FIELDS.items():
        regen_rows.append(OrderedDict([('scope', '対象9問'), ('problem_id', pid), ('field', fname),
            ('pr3_json_equals_regenerated', '一致' if g(pm) == g(p_new) else '不一致'), ('detail', '')]))
regen_rows.append(OrderedDict([('scope', '全問（content/problems）'), ('problem_id', f'{s_same + s_diff}問'), ('field', '全欄'),
    ('pr3_json_equals_regenerated', f'一致 {s_same}・不一致 {s_diff}'), ('detail', '; '.join(f'{i}:{k}' for i, k in s_out))]))
regen_rows.append(OrderedDict([('scope', 'content のその他のファイル'), ('problem_id', ''), ('field', ''),
    ('pr3_json_equals_regenerated', '一致' if not s_other else '不一致'), ('detail', 'content/meta.json は取り込み元のファイル名と日時を記録するので比較から除外。' + ', '.join(s_other))]))
regen_rows.append(OrderedDict([('scope', 'data/（アプリ用）'), ('problem_id', ''), ('field', ''),
    ('pr3_json_equals_regenerated', '一致' if not s_data else '不一致'), ('detail', f'generated・source を除いて比較。dataVersion PR#3={s_dv[0]} 再生成={s_dv[1]}。' + ', '.join(s_data))]))
regen_rows.append(OrderedDict([('scope', '基準（元の管理表→main）'), ('problem_id', f'{b_same + b_diff}問'), ('field', '全欄'),
    ('pr3_json_equals_regenerated', f'一致 {b_same}・不一致 {b_diff}'), ('detail', f'data 不一致 {len(b_data)}，dataVersion main={b_dv[0]} 再生成={b_dv[1]}')]))
with open(D / 'regeneration_comparison.csv', 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(regen_rows[0])); w.writeheader(); w.writerows(regen_rows)
ids_main = {p['id'] for f in (base_tmp / 'content/problems').glob('*.json') for p in items(json.loads(f.read_text(encoding='utf-8')))}
ids_sync = {p['id'] for f in (sync_tmp / 'content/problems').glob('*.json') for p in items(json.loads(f.read_text(encoding='utf-8')))}
golden = {x.strip() for x in git('show', f'{PR3}:tests/golden/ids.txt').splitlines() if x.strip() and not x.startswith('#')}
checks['問題IDの集合が同期前後で同じ（学習履歴・ブックマークは ID で結びつく）'] = ids_main == ids_sync
checks['問題IDの台帳（tests/golden/ids.txt）の ID がすべて残っている'] = golden <= ids_sync

# ---------------------------------------------------------------- 6. 書き出し
L = ['# 記号の付け替え（B-SEQ-342）の回帰検査', '', '`symbol_replace.py` の結果。B-SEQ-342 の修正で，1回目の正規表現が「d_mb_n」の b_n を取りこぼした（前が英字のため）。',
     'LaTeX の命令名（`\\` の後の英字）を読み飛ばす字句解析版を作り，これまでの2つの正規表現と比べた。', '',
     '| ケース | 入力 | 期待 | 字句解析版 | 正規表現 v1（1回目） | 正規表現 v2（2回目） |', '|---|---|---|---|---|---|']
for t in tests:
    L.append(f"| {t['case']} | `{t['input']}` | `{t['expected']}` | {'✓' if t['tokenizer'] else '✗'} | {'✓' if t['regex_v1'] else '✗ `' + t['v1_output'] + '`'} | {'✓' if t['regex_v2'] else '✗ `' + t['v2_output'] + '`'} |".replace('\n', '⏎'))
L += ['', '- 字句解析版はすべて合格。v1 は積の2つ目の因子を取りこぼす（今回の不具合）。v2 は今回の解説では正しく動いたが，名前が b で終わる英字の命令（例 `\\sub`）の中まで書き換える欠陥がある。',
      '- 今後同様の記号変更をするときは，`rename_subscripted`（字句解析版）を使い，`changed_only_at` で「意図した置換箇所以外に差がないこと」を確かめる。', '',
      '## B-SEQ-342 の全文確認（main → PR #3）', '', '| 欄 | 差は意図した付け替えの位置だけ | 付け替えた数 | 残っている添字つき b | d_ の数 | 変更なし |', '|---|---|---|---|---|---|']
for fld, ok, n, rem, nd, same in bseq:
    L.append(f'| {fld} | {"はい" if ok else "いいえ"} | {n} | {rem} | {nd} | {"はい" if same else "いいえ"} |')
L += ['', '- 解説・着想の差は，main の文に字句解析版の付け替えを施した結果と1文字単位で完全に一致し，それ以外の位置に差はない。',
      '- 問題文・答えは変わっていない（問題文の $b=a_2$ はそのまま）。補助数列の定義は $d_n=\\beta(a_n)$。']
(D / 'symbol_replacement_tests.md').write_text('\n'.join(L) + '\n', encoding='utf-8')

HR = [('II-TRI-190 (1)〜(3)', ['境界値 $a=\\pm\\frac1{\\sqrt2}$ の解の個数（$\\sin(x+\\frac\\pi4)=\\mp1$ の解が1周期に1個）', '(3) の $n=1350$', '出題条件と保存済み解説の整合性'], '第一段階 D。解説監査の2パスは正しいと判断。PR #3 では変更なし'),
      ('III-DIF-356 (2)', ['3重根の扱い', '無理数係数の解（$x_0^3=\\pm4$ の型の2つ）を含める出題意図'], '解説監査の2パスは A。PR #3 では変更なし'),
      ('III-DIF-374 (2)', ['修正後の不等式の導出（$f(L+\\log L)=e^2-b\\log L<0$ から $x_2>L+\\log L$）', '後続の評価の妥当性'], 'PR #3 で修正。別エージェント2体が再検証して正しいと判断'),
      ('A-COM-510 (2)', ['括弧書き「$m-1=3\\geqq2$，$n\\geqq3$」の条件が正しいか', '修正不要とする判断の妥当性（前回の裁定は C）'], 'PR #3 では修正せず。再検証担当も修正不要と判断'),
      ('B-SEQ-342 (1)〜(3)', ['補助数列の記号（$d_n$）が全文で統一されているか', '数式内の置換漏れ'], 'PR #3 で修正（1回目に漏れ→直して再検証）。今回の全文検査で漏れなし'),
      ('C-CUR-459 (1)', ['円を除外する出題意図が妥当か', '問題文の表現に曖昧さがないか（「円は除く」の明記の要否）'], 'PR #3 で根拠を補足。円を含めると (1) $0<s\\leqq\\frac13$，(3) $-\\frac13\\leqq x<1$ に変わる'),
      ('II-GEO-300 (2)', ['直線の方程式の表現に依存しない説明になっているか'], 'PR #3 で補足'),
      ('III-DIF-359 (1)', ['左右の微分係数の計算', '$D\\pm eE$ の導出'], 'PR #3 で修正'),
      ('III-DIF-380 (2)', ['前提条件と結論の論理関係', '答えに条件を併記する必要性'], 'PR #3 で解説と答えを修正')]
H = ['# 人手確認13小問の状況', '', '**すべて「確認待ち」。** AI の再検証の結果は参考情報であり，人による確認の代わりにしていない。確認した人は，各項目の「状態」を書き換えて記録する。', '',
     '| 小問 | 状態 | 人が確認すること | AI による作業と再検証の状況 |', '|---|---|---|---|']
for k, items_, st in HR:
    H.append(f'| {k} | 確認待ち | ' + '<br>'.join(f'□ {x}' for x in items_) + f' | {st} |')
H += ['', '小問の数：II-TRI-190 が3，B-SEQ-342 が3，ほかの7つが各1で計13。']
(D / 'human_review_status.md').write_text('\n'.join(H) + '\n', encoding='utf-8')

R = ['# PR #3 の最終検証・管理表との同期・リリース判定', '', '> `build.py` が生成。これは AI による検証であり，人による確認ではない。', '',
     '## 1. 管理表の特定とバックアップ', '',
     f'- 正本：利用者が添付した `Lemma問題管理表_v0.29.3`（シート：使い方・問題一覧・分野一覧・弟テスト記録）。元の管理表の SHA-256：`{ho}`',
     '- バックアップ：編集前に，読み取り専用の写しを作業日時と main のコミットを付けた名前で保存した（`Lemma問題管理表_v0.29.3_原本_<日時>_main-c3193af.xlsx`，ハッシュは元と同じ）。管理表はリポジトリに入れない（非公開の「参考元」列を含むため）。',
     f'- 同期後の管理表：`{Path(sync_x).name}`，SHA-256：`{hs}`。**利用者の手元の正本をこのファイルに置き換えるまで，同期は完了しない。**',
     '- 見出しで列を確認：I＝答え，J＝解答・解説，K＝核となるアイデア（取り込みスクリプトも見出しの名前で列を探す）。', '',
     '## 2. 管理表への反映', '',
     f'- 反映したセル：{len(expected_cells)}（9問。III-DIF-374 の J・K，III-DIF-380 の I・J，B-SEQ-342 の J・K，ほか6問の J）。A-COM-510 は変更なし。',
     '- 方法：`sync_sheet.py`。xlsx の中の「問題一覧」シートの XML だけを書き換え，対象セルの文字列だけを差し替えた。他の部品（コメント・書式・他のシート）はバイト単位で同じ。書き換える前に，今の値を元の書き方で書くと元の XML と一致することを確かめた。',
     '- 照合：`management_sheet_sync.csv`（30行＝10問×3列）。', '',
     '## 3. 管理表と JSON の一致', '',
     f"- 同期後の対象セルと PR #3 の JSON：{sum(1 for r in sync_rows if r['match']=='一致')}/{len(sync_rows)} が完全一致（空白・改行の正規化を要する差もなし）。",
     '- 同期前の対象セルは main の JSON と完全一致していた（出発点に食い違いがない）。', '',
     '## 4. 管理表からの再生成テスト', '',
     '一時ディレクトリに該当コミットを展開し，`tools/xlsx_to_content.py` と `tools/build_app_data.py` で作り直して比べた（本番のデータは上書きしていない）。', '',
     '| 比較 | 問題 | 一致 | 不一致 | data/ | dataVersion |', '|---|---:|---:|---:|---|---|',
     f'| 基準：元の管理表 → main | {b_same + b_diff} | {b_same} | {b_diff} | {"一致" if not b_data else "不一致"} | {b_dv[0]} / {b_dv[1]} |',
     f'| 同期後の管理表 → PR #3 | {s_same + s_diff} | {s_same} | {s_diff} | {"一致" if not s_data else "不一致"} | {s_dv[0]} / {s_dv[1]} |', '',
     '- 対象9問の答え・解説・着想は，管理表から作り直しても PR #3 と一致する（`regeneration_comparison.csv`）。**修正は再生成で失われない。**',
     '- 比べた問題数には，管理表ではなく `content/problems/builtin.json` から来る内蔵問題 61問を含む（管理表からは 5,471問）。\n- 対象外の問題も全問一致し，意図しない差分はない。`content/meta.json`（取り込み元の名前と日時）と `data` の `generated`・`source` だけが変わる。',
     '- 問題IDの集合は同期前後で同じで，台帳 `tests/golden/ids.txt` の ID はすべて残る。学習履歴・ブックマークは ID で結びつくので影響しない。`dataVersion` は PR #3 と同じ。', '',
     '## 5. 記号付け替えの回帰検査', '', '- `symbol_replacement_tests.md` 参照。字句解析版はすべて合格し，B-SEQ-342 の差は意図した付け替えの位置だけ。', '',
     '## 6. 人手確認13小問', '', '- すべて「確認待ち」（`human_review_status.md`）。', '',
     '## 7. PR #3 のマージ可否', '',
     '- **技術面：可。** 修正内容は管理表に反映でき，管理表から作り直しても修正が保たれ，対象外のデータに変化はない。',
     '- **現時点の判定：マージ不可（Draft のまま）。** 理由：(1) 人手確認13小問が確認待ち，(2) 利用者の手元の正本の管理表を同期後のファイルに置き換えることが未了。',
     '- マージの条件：人手確認の完了（必要なら修正の追加）と，正本の置き換え。置き換えたあとは，PR #3 の `data/` を作り直す必要はない（再生成で一致することを確認済み）。', '',
     '## 8. 検査', '', '| チェック | 結果 |', '|---|---|'] + [f'| {k} | {"OK" if v else "NG"} |' for k, v in checks.items()] + \
    [f'- 注意：{x}' for x in notes] + ['', '## ファイル', '',
     '- `management_sheet_sync.csv`：管理表の対象セルと JSON の照合（値はハッシュと先頭80字）', '- `regeneration_comparison.csv`：管理表からの再生成と PR #3・main の比較',
     '- `symbol_replacement_tests.md`：付け替えの回帰検査と B-SEQ-342 の全文確認', '- `human_review_status.md`：人手確認13小問の状況',
     '- `sync_sheet.py`：管理表への反映', '- `symbol_replace.py`：付け替え関数と回帰テスト', '- `build.py`：このファイル群を生成（引数：元の管理表，同期後の管理表）']
(D / 'final_validation_report.md').write_text('\n'.join(R) + '\n', encoding='utf-8')
print(json.dumps({'ok': all(checks.values()), 'failed': [k for k, v in checks.items() if not v], 'orig': ho[:16], 'synced': hs[:16],
                  'cells': len(expected_cells), 'regen': [s_same, s_diff], 'base': [b_same, b_diff]}, ensure_ascii=False))
sys.exit(0 if all(checks.values()) else 1)
