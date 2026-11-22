#!/usr/bin/env python3
"""解法カード（content/techniques.json）と問題との結びつきを検査する。

  python3 tools/audit_techniques.py              # 検査して要約を出す（誤りがあれば終了コード 1）
  python3 tools/audit_techniques.py --csv DIR    # 人が確認する一覧（未結びつき・要確認・結びつきの多い問題）を CSV で書き出す
  python3 tools/audit_techniques.py --write-golden   # 今の解法 ID を tests/golden/techniques.txt に追記する

検査すること（誤り）：ID・名前・旧 ID の重複、pre/rec/rel/alt の参照先、自分自身への参照、pre＋rec の循環、
種類・分類の値、必須の文章の欠け、以前あった解法 ID の消失（tests/golden/techniques.txt。旧 ID は former に残せばよい）、
data/techniques.json の問題 ID が問題の索引にあるか、管理表の「解法」列の名前。
報告すること（警告）：前提の多すぎる解法、問題の少ない解法、結びつかない問題、分野が外れている結びつき（要確認）、
解法が5つ以上結びつく問題。
"""
import json, sys, csv, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GOLDEN = ROOT / 'tests' / 'golden' / 'techniques.txt'
REQUIRED = ('summary', 'essence', 'when', 'cue', 'caution')


def load(root=ROOT):
    doc = json.loads((root / 'content' / 'techniques.json').read_text(encoding='utf-8'))
    data = json.loads((root / 'data' / 'techniques.json').read_text(encoding='utf-8'))
    index = json.loads((root / 'data' / 'index.json').read_text(encoding='utf-8'))['problems']
    return doc, data, index


def find_cycle(graph):
    """有向グラフ（id → [前提 id]）の循環を1つ返す（なければ None）"""
    color, stack = {}, []

    def dfs(u):
        color[u] = 1; stack.append(u)
        for v in graph.get(u, []):
            if color.get(v) == 1:
                return stack[stack.index(v):] + [v]
            if not color.get(v):
                c = dfs(v)
                if c:
                    return c
        color[u] = 2; stack.pop()
        return None
    for u in graph:
        if not color.get(u):
            c = dfs(u)
            if c:
                return c
    return None


def check(root=ROOT):
    doc, data, index = load(root)
    E, W = [], collections.Counter()
    ts = doc['techniques']
    ids = [t['id'] for t in ts]
    idset = set(ids)
    kinds = {k['id'] for k in doc.get('kinds', [])}
    groups = {g['id'] for g in doc['groups']}
    seen = {}
    for t in ts:
        for x in [t['id'], t['name'], *t.get('former', [])]:
            if x in seen and seen[x] != t['id']:
                E.append(f'解法の ID・名前・旧 ID「{x}」が {seen[x]} と {t["id"]} で重複')
            seen[x] = t['id']
        for x in t.get('former', []):
            if x in idset:
                E.append(f'{t["id"]}: 旧 ID {x} が今の ID と同じ')
        if t.get('kind') not in kinds:
            E.append(f'{t["id"]}: 種類 {t.get("kind")} が kinds に無い')
        if t['group'] not in groups:
            E.append(f'{t["id"]}: 分類 {t["group"]} が groups に無い')
        for k in REQUIRED:
            if not str(t.get(k, '')).strip():
                E.append(f'{t["id"]}: {k} が空')
        if not t.get('tags'):
            W['タグの無い解法（管理表の「解法」列でしか結びつかない）'] += 1
        for k in ('pre', 'rec', 'rel', 'alt'):
            for x in t.get(k, []):
                if x not in idset:
                    E.append(f'{t["id"]}: {k} の {x} が無い')
                if x == t['id']:
                    E.append(f'{t["id"]}: {k} に自分自身')
        if len(t.get('pre', [])) + len(t.get('rec', [])) > 4:
            W['前提（pre＋rec）が5つ以上の解法'] += 1
        for w in t.get('weak', []):
            if w not in t.get('tags', []):
                E.append(f'{t["id"]}: weak の {w} が tags に無い')
    if len(set(ids)) != len(ids):
        E.append('解法 ID が重複している')
    cyc = find_cycle({t['id']: t.get('pre', []) + t.get('rec', []) for t in ts})
    if cyc:
        E.append('前提（pre・rec）が循環している：' + ' → '.join(cyc))
    # 以前あった ID の消失
    if GOLDEN.exists():
        known = set(ids) | {x for t in ts for x in t.get('former', [])}
        for x in GOLDEN.read_text(encoding='utf-8').split():
            if x not in known:
                E.append(f'以前あった解法 ID {x} が無い（改名・統合したら移した先の former に書く）')
    # 書き出したデータとの整合
    pidx = {e['id']: e for e in index}
    dts = {t['id']: t for t in data['techniques']}
    if set(dts) != idset:
        E.append('data/techniques.json が content と合わない → python3 tools/build_app_data.py')
    by_problem = collections.defaultdict(list)
    for t in data['techniques']:
        for pid in t['ids']:
            if pid not in pidx:
                E.append(f'{t["id"]}: 問題 {pid} が索引に無い')
            by_problem[pid].append(t['id'])
        if not set(t['main']) <= set(t['ids']):
            E.append(f'{t["id"]}: 主な解法の問題が結びつきに含まれていない')
        if len(t['ids']) < 10:
            W['結びつく問題が10問未満の解法'] += 1
    # 分野が外れている結びつき：その解法の結びつきのうち 3% 未満の分野にある、タグから自動の結びつき
    manual = set(data.get('manual', []))
    field_share = {}
    for t in data['techniques']:
        c = collections.Counter(pidx[p]['f'] for p in t['ids'] if p in pidx)
        field_share[t['id']] = {f: n / max(1, len(t['ids'])) for f, n in c.items()}
    suspect = [(pid, tid) for pid, tl in by_problem.items() for tid in tl
               if pid not in manual and field_share[tid].get(pidx[pid]['f'], 0) < 0.03]
    unlinked = [e for e in index if e['id'] not in by_problem]
    many = [(pid, tl) for pid, tl in by_problem.items() if len(tl) >= 5]
    nomain = [pid for pid in by_problem if not any(pid in dts[t]['main'] for t in by_problem[pid])]
    rep = {'problems': len(index), 'linked': len(by_problem), 'with_main': len(by_problem) - len(nomain), 'manual': len(manual),
           'unlinked': unlinked, 'suspect': suspect, 'many': many, 'nomain': nomain,
           'per_problem': collections.Counter(len(v) for v in by_problem.values())}
    if suspect:
        W['分野が外れている自動の結びつき（要確認）'] = len(suspect)
    if many:
        W['解法が5つ以上結びつく問題'] = len(many)
    return E, W, rep


def main():
    args = sys.argv[1:]
    if '--write-golden' in args:
        doc = json.loads((ROOT / 'content' / 'techniques.json').read_text(encoding='utf-8'))
        old = GOLDEN.read_text(encoding='utf-8').split() if GOLDEN.exists() else []
        new = old + [t['id'] for t in doc['techniques'] if t['id'] not in old]
        GOLDEN.write_text('\n'.join(new) + '\n', encoding='utf-8')
        print(f'{GOLDEN} に {len(new) - len(old)} 個追記（計 {len(new)}）')
        return 0
    E, W, rep = check()
    n = rep['problems']
    print(f"解法：問題 {n}問のうち 結びつく {rep['linked']}問（{rep['linked'] / n:.0%}）・主な解法がある {rep['with_main']}問・管理表で指定 {rep['manual']}問")
    print('  1問あたりの解法の数：' + '、'.join(f'{k}個 {v}問' for k, v in sorted(rep['per_problem'].items())))
    unl = collections.Counter(e['f'] for e in rep['unlinked'])
    print('  結びつかない問題（分野別）：' + '、'.join(f'{f} {c}' for f, c in unl.most_common()))
    for k, v in W.items():
        print(f'  警告：{k} {v}')
    for e in E:
        print('  誤り：' + e)
    if '--csv' in args:
        out = Path(args[args.index('--csv') + 1]); out.mkdir(parents=True, exist_ok=True)
        pidx = {e['id']: e for e in load()[2]}
        def w(name, head, rows):
            with open(out / name, 'w', newline='', encoding='utf-8-sig') as f:
                cw = csv.writer(f); cw.writerow(head); cw.writerows(rows)
        w('unlinked.csv', ['問題ID', '分野', 'テーマ', 'タグ'], [[e['id'], e['f'], e.get('th', ''), '、'.join(e.get('tg', []))] for e in rep['unlinked']])
        w('suspect.csv', ['問題ID', '分野', 'テーマ', '解法ID', 'タグ'], [[p, pidx[p]['f'], pidx[p].get('th', ''), t, '、'.join(pidx[p].get('tg', []))] for p, t in rep['suspect']])
        w('many.csv', ['問題ID', 'テーマ', '解法'], [[p, pidx[p].get('th', ''), '、'.join(tl)] for p, tl in rep['many']])
        print(f'  CSV を {out} に書き出しました')
    return 1 if E else 0


if __name__ == '__main__':
    sys.exit(main())
