#!/usr/bin/env python3
"""ID 照合の件数を、成果物（CSV）・content/・Git・管理表から数え直して確かめる（読み取りだけ）。

    python3 verify_idmap.py --repo . --xlsx 管理表.xlsx [--batch 管理表2.xlsx ...]

- 管理表が無くても --repo だけで CSV と content/ の整合は確かめられる（管理表を使う確認は飛ばす）。
- 結果は標準出力と numbers.json（--out で場所を指定）に書く。どれか1つでも合わなければ終了コード 1。
"""
import argparse
import csv
import hashlib
import json
import subprocess
import sys
import warnings
from collections import Counter, defaultdict
from pathlib import Path

warnings.filterwarnings('ignore')
ap = argparse.ArgumentParser()
ap.add_argument('--repo', default='.')
ap.add_argument('--xlsx')
ap.add_argument('--batch', action='append', default=[])
ap.add_argument('--out')
A = ap.parse_args()
REPO = Path(A.repo).resolve()
D = REPO / 'docs/audit/2026-11-23/idmap'
OUT = Path(A.out) if A.out else D / 'numbers.json'
fails, nums, notes = [], {}, []


def check(name, ok, detail=''):
    print(('✓ ' if ok else '✗ ') + name + (f'：{detail}' if detail else ''))
    if not ok:
        fails.append(name)


def rd(name):
    return list(csv.DictReader(open(D / name, encoding='utf-8-sig')))


M = rd('id_mapping.csv')
C = list(csv.reader(open(D / 'id_conflicts.csv', encoding='utf-8-sig')))[1:]
UA = rd('unmatched_app.csv')
UE = rd('unmatched_excel.csv')
S = json.load(open(D / 'summary.json'))
by = {m['app_id']: m for m in M}

# ---------------------------------------------------------------- アプリの問題数
app = {}
for f in sorted((REPO / 'content/problems').glob('*.json')):
    if f.name == 'builtin.json':
        continue
    for x in json.loads(f.read_text()):
        app[x['id']] = x
pub = sum((x.get('quality') or {}).get('status') != 'hidden' for x in app.values())
nums['app'] = dict(total=len(app), published=pub, hidden=len(app) - pub)
check('アプリの問題数（管理表由来）', len(app) == 5217 and pub == 5216, f'{len(app)}（公開 {pub}・非表示 {len(app) - pub}）')
check('id_mapping.csv はアプリの全問題を1行ずつ', len(M) == len(app) and set(by) == set(app) and len(by) == len(M), f'{len(M)}行')

# ---------------------------------------------------------------- 分類
cat = Counter(m['match_category'] for m in M)
nums['categories'] = dict(sorted(cat.items()))
check('分類の件数が summary.json と同じ', dict(sorted(cat.items())) == S['categories'], str(dict(sorted(cat.items()))))
check('分類の合計＝アプリの問題数', sum(cat.values()) == len(app))

# 1対1・多対1・1対多
multi_app = [m for m in M if '／' in m['excel_id']]           # 1対多（アプリ1問に管理表の候補が複数）
check('1対多（アプリ1問に複数の候補）は F だけ', all(m['match_category'] == 'F' for m in multi_app), f'{len(multi_app)}件')
conf_ex = defaultdict(list)                                   # 確定した対応（A・B・D と、同じIDの E）
for m in M:
    if m['match_category'] in 'ABD' or (m['match_category'] == 'E' and m['excel_id'] == m['app_id']):
        conf_ex[m['excel_id']].append(m['app_id'])
dup = {k: v for k, v in conf_ex.items() if len(v) > 1}
check('確定した対応は1対1（管理表の同じ行に確定の対応が2つ無い）', not dup, f'確定 {sum(len(v) for v in conf_ex.values())}組')
cand_ex = defaultdict(list)
for m in M:
    if m['excel_id'] and '／' not in m['excel_id']:
        cand_ex[m['excel_id']].append(m['app_id'])
many = {k: v for k, v in cand_ex.items() if len(v) > 1}
many_kind = Counter(tuple(sorted(by[a]['match_category'] for a in v)) for v in many.values())
nums['many_to_one'] = dict(count=len(many), kinds={'+'.join(k): n for k, n in many_kind.items()})
check('多対一＝確定1＋E の候補', all(sum(by[a]['match_category'] != 'E' or by[a]['excel_id'] == a for a in v) <= 1 for v in many.values()),
      f'{len(many)}行（{dict(nums["many_to_one"]["kinds"])}）')
check('多対一の件数が id_conflicts.csv と同じ', len(many) == sum(c[0] == '多対一' for c in C))

# 同じIDで別の問題
same_both = set(app) & {m['excel_id'] for m in M if m['excel_id'] and '／' not in m['excel_id']} | set()
diff_same_id = [c for c in C if c[0] == '同一ID別問題']
nums['same_id_other'] = len(diff_same_id)
note_ids = {c[1] for c in diff_same_id}
for c in diff_same_id:
    if by[c[1]]['excel_id'] == c[1]:
        fails.append(f'同一ID別問題 {c[1]} はアプリでも同じIDに対応している')

# ---------------------------------------------------------------- E の内訳と人の確認
E = [m for m in M if m['match_category'] == 'E']
def ekind(m):
    if 'v0.27' in m['reason']: return 'v0.27.0 の修正'
    if '言い回し' in m['reason']: return '同じIDで言い回しが違う'
    if '消えている' in m['reason']: return '管理表から消えた類題'
    return 'その他の類題'
ek = Counter(ekind(m) for m in E)
nums['E'] = dict(ek)
check('E の内訳の合計＝E', sum(ek.values()) == len(E), str(dict(ek)))
hum = Counter(m['match_category'] for m in M if m['human_review_required'] == '要')
nums['human'] = dict(total=sum(hum.values()), **hum)
check('人の確認＝E（v0.27.0 の修正を除く）＋G', hum.get('E', 0) == len(E) - ek['v0.27.0 の修正'] and hum.get('G', 0) == cat['G']
      and sum(hum.values()) == S['human'], f'{sum(hum.values())}（{dict(hum)}）')
check('unmatched_app.csv＝G', len(UA) == cat['G'] and {u['app_id'] for u in UA} == {m['app_id'] for m in M if m['match_category'] == 'G'})

# ---------------------------------------------------------------- Git：アプリの ID の履歴
def ids_at(rev):
    names = subprocess.run(['git', '-C', str(REPO), 'ls-tree', '--name-only', rev, 'content/problems/'], capture_output=True, text=True).stdout.split()
    out = {}
    for n in names:
        if n.endswith('builtin.json'): continue
        for x in json.loads(subprocess.run(['git', '-C', str(REPO), 'show', f'{rev}:{n}'], capture_output=True, text=True).stdout):
            out[x['id']] = (x['statement']['tex'] if isinstance(x['statement'], dict) else x['statement']).strip()
    return out


REVS = ['7ac6982', '4d6042c', '523bde6', '8441ea3']
have_git = subprocess.run(['git', '-C', str(REPO), 'cat-file', '-e', REVS[0]], capture_output=True).returncode == 0
commit_of = {}
if have_git:
    prev = {}
    hist = []
    for r in REVS + ['HEAD']:
        cur = ids_at(r)
        add, rem = set(cur) - set(prev), set(prev) - set(cur)
        chg = [i for i in set(cur) & set(prev) if cur[i] != prev[i]]
        hist.append(dict(rev=r, total=len(cur), added=len(add), removed=len(rem), statement_changed=len(chg)))
        for i in add:
            commit_of.setdefault(i, r)
        prev = cur
    nums['git'] = hist
    check('Git：アプリの ID は消えていない・付け替えられていない', all(h['removed'] == 0 for h in hist)
          and all(h['statement_changed'] == 0 for h in hist[:-1]), '; '.join(f"{h['rev']} {h['total']}(+{h['added']}/-{h['removed']}/文変更{h['statement_changed']})" for h in hist))
else:
    print('- Git の履歴が無いので、履歴の確認は飛ばした')

created = lambda i: (app[i].get('provenance') or {}).get('created')
c1030 = [i for i in app if created(i) == '2026-10-30']
deleted = sorted(m['app_id'] for m in M if created(m['app_id']) == '2026-10-30' and (m['match_category'] == 'G' or (m['match_category'] == 'E' and m['excel_id'] != m['app_id'])))
shifted = sorted(m['app_id'] for m in M if m['match_category'] == 'D' and (not commit_of or commit_of.get(m['app_id']) == '7ac6982'))
nums['created_1030'] = len(c1030)
nums['deleted_from_excel'] = len(deleted)
nums['shifted_in_excel'] = len(shifted)
check('10-30 作成＝管理表から消えた＋ID が詰まった＋同じIDのまま', len(c1030) == len(deleted) + len(shifted) + sum(
    1 for i in c1030 if by[i]['excel_id'] == i), f'{len(c1030)} = 消えた {len(deleted)} + 詰まった {len(shifted)} + 同じID {sum(1 for i in c1030 if by[i]["excel_id"] == i)}')
check('ID が詰まった問題はすべて 10-30 作成', all(created(i) == '2026-10-30' for i in shifted))

# 詰め直しの規則：管理表の番号＝アプリの番号−（同じ接頭辞で、それより小さい番号の消えた問題の数）
delp = defaultdict(list)
for i in deleted:
    p, n = i.rsplit('-', 1); delp[p].append(int(n))
ok_rule, bad_rule = 0, []
for i in shifted:
    p, n = i.rsplit('-', 1); n = int(n)
    ep, en = by[i]['excel_id'].rsplit('-', 1)
    if ep == p and int(en) == n - sum(1 for d in delp[p] if d < n): ok_rule += 1
    else: bad_rule.append(f'{i}→{by[i]["excel_id"]}')
nums['shift_rule'] = dict(ok=ok_rule, bad=len(bad_rule), examples=bad_rule[:10])
check('詰め直しの規則で、ID が詰まった全問題の管理表の ID を説明できる', not bad_rule, f'{ok_rule}/{len(shifted)}' + (f'（外れ {bad_rule[:5]}）' if bad_rule else ''))

renamed = sorted(m['app_id'] for m in M if m['match_category'] == 'D' and commit_of and commit_of.get(m['app_id']) != '7ac6982')
nums['renamed_batches'] = len(renamed)
check('D＝詰まった＋管理表2〜4の付け替え（重なりなし）', cat['D'] == len(shifted) + len(renamed) and not (set(shifted) & set(renamed)),
      f'{cat["D"]} = {len(shifted)} + {len(renamed)}')
if commit_of:
    nums['renamed_by_commit'] = dict(Counter(commit_of[i] for i in renamed))

# ---------------------------------------------------------------- 管理表
if A.xlsx:
    import openpyxl
    h = hashlib.sha256(open(A.xlsx, 'rb').read()).hexdigest()
    nums['xlsx'] = dict(path=Path(A.xlsx).name, sha256=h)
    ws = openpyxl.load_workbook(A.xlsx, read_only=True, data_only=True)['問題一覧']
    rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if r[0]]
    ids = [str(r[0]).strip() for r in rows]
    nums['excel'] = dict(rows=len(rows), unique_ids=len(set(ids)))
    check('管理表の行数・ID の重複なし', len(rows) == S['excel'] == len(set(ids)), f'{len(rows)}行・sha256 {h[:16]}…')
    accounted = Counter()
    for m in M:
        if m['excel_id'] in conf_ex and m['app_id'] in conf_ex[m['excel_id']]:
            accounted[m['excel_id']] += 1
    rest = set(ids) - set(accounted)
    check('管理表の全行＝確定した対応＋対応先なし', len(accounted) + len(UE) == len(ids) and rest == {u['excel_id'] for u in UE},
          f'{len(accounted)} + {len(UE)} = {len(ids)}')
    both = set(ids) & set(app)
    same_matched = {i for i in both if by[i]['excel_id'] == i}
    check('同一ID別問題＝両方にある ID − 同じ ID で対応した ID', len(both - same_matched) == len(diff_same_id) and (both - same_matched) == note_ids,
          f'{len(both)} − {len(same_matched)} = {len(both - same_matched)}')
    nums['ids_both'] = len(both); nums['ids_app_only'] = len(set(app) - set(ids)); nums['ids_excel_only'] = len(set(ids) - set(app))
    check('管理表にだけある行の ID の重複', sum(u['app_same_id'].startswith('あり') for u in UE) + nums['ids_excel_only'] == len(UE),
          f'既存のアプリ ID と同じ {sum(u["app_same_id"].startswith("あり") for u in UE)}・新しい ID {nums["ids_excel_only"]}')

# 管理表2〜4の「ID対応」
if A.batch and commit_of:
    import openpyxl
    mp = {}
    for f in A.batch:
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        if 'ID対応' in wb.sheetnames:
            for a, b in list(wb['ID対応'].iter_rows(values_only=True))[1:]:
                if a and a != b: mp[b] = a
    ok = [i for i in renamed if mp.get(i) == by[i]['excel_id']]
    nums['renamed_explained_by_sheet'] = len(ok)
    check('付け替えはすべて「ID対応」シートの記録どおり', len(ok) == len(renamed), f'{len(ok)}/{len(renamed)}')

# v0.27.1 の excel_divergence.csv（ID ごとに問題文をそのまま比べた）との関係
dv = D.parent / 'excel_divergence.csv'
if dv.exists():
    rows_dv = list(csv.DictReader(open(dv, encoding='utf-8-sig')))
    n_dv = sum(r['種類'] == '同じIDが別の問題' for r in rows_dv)
    ids_dv = {r['問題ID'] for r in rows_dv if r['種類'] == '同じIDが別の問題'}
    wording = {m['app_id'] for m in E if ekind(m) == '同じIDで言い回しが違う'}
    nums['v0271_same_id_other'] = dict(total=n_dv, different_problem=len(ids_dv & note_ids), same_problem_wording=len(ids_dv & wording))
    check('v0.27.1 の「同じIDが別の問題」＝別の問題＋同じ問題の言い回し違い', ids_dv == note_ids | wording,
          f'{n_dv} = {len(ids_dv & note_ids)} + {len(ids_dv & wording)}')

json.dump(dict(numbers=nums, failed=fails), open(OUT, 'w'), ensure_ascii=False, indent=1)
(D / 'deleted_from_excel.txt').write_text('\n'.join(deleted) + '\n')
print('\n' + ('すべて合っています' if not fails else f'{len(fails)} 件合いません：' + '／'.join(fails)))
sys.exit(1 if fails else 0)
