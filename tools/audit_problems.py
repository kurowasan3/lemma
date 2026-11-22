#!/usr/bin/env python3
"""問題の品質確認を助ける一覧を作る（問題は消さない・書きかえない）。

  python3 tools/audit_problems.py                 # 要約だけ
  python3 tools/audit_problems.py --csv DIR       # DIR に similar.csv・quality.csv を書き出す（Excel で開ける UTF-8）

1) 類似・重複の候補（similar.csv）
   - 同一：問題文が空白・記号の違いを除いて同じ
   - 数値違い：数字をすべて同じ記号に置きかえると同じ（数値だけ変えた類題）
   - 類似：数字を置きかえた問題文の文字4-gram の Jaccard 係数が 0.7 以上（MinHash で候補を出し、実際の値で確かめる）
   文字列の比較なので、数学的に同じでも表現が違うもの（文字の置きかえ・言い回しの違い）は見つからない。
   候補は人が見て、残す・まとめる・差しかえるを決める。
2) 品質の一覧（quality.csv）
   自動で確かめられる項目と、人が判断する項目（空欄）を分けた表。管理表の問題 ID で引ける。
"""
import json, re, sys, csv, random, hashlib, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HUMAN = ['数学的正確性', '問題文の明確さ', '解答の正確性', '解説の十分性', '難易度の妥当性', '教育的価値', '他の問題との差別化', '分類・タグの妥当性', '収録する価値']


def load():
    ps = []
    for f in sorted((ROOT / 'content' / 'problems').glob('*.json')):
        if f.name == 'builtin.json':
            continue
        ps += json.loads(f.read_text(encoding='utf-8'))
    return [p for p in ps if p['quality']['status'] == 'published']


def norm(tex, mask_digits):
    s = re.sub(r'\\(?:,|;|!|quad|qquad| )', '', tex)
    s = re.sub(r'[\s，,．.、。　]+', '', s)
    if mask_digits:
        s = re.sub(r'\d+(?:\.\d+)?', '#', s)
    return s


def shingles(s, k=4):
    return {s[i:i + k] for i in range(max(1, len(s) - k + 1))}


def similar_pairs(ps, thr=0.7, perms=64, bands=16):
    random.seed(7)
    P = (1 << 61) - 1
    A = [(random.randrange(1, P), random.randrange(0, P)) for _ in range(perms)]
    sh = {}
    for p in ps:
        S = shingles(norm(p['statement']['tex'], True))
        hs = [int.from_bytes(hashlib.blake2b(x.encode(), digest_size=8).digest(), 'little') for x in S]
        sh[p['id']] = (S, [min((a * h + b) % P for h in hs) for a, b in A])
    r = perms // bands
    buckets = collections.defaultdict(list)
    for pid, (_, sig) in sh.items():
        for bi in range(bands):
            buckets[(bi, tuple(sig[bi * r:(bi + 1) * r]))].append(pid)
    cand = set()
    for ids in buckets.values():
        if 1 < len(ids) < 50:
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    cand.add(tuple(sorted((ids[i], ids[j]))))
    out = []
    for a, b in cand:
        A_, B_ = sh[a][0], sh[b][0]
        jac = len(A_ & B_) / max(1, len(A_ | B_))
        if jac >= thr:
            out.append((a, b, jac))
    return sorted(out, key=lambda x: -x[2])


def main():
    args = sys.argv[1:]
    ps = load()
    byid = {p['id']: p for p in ps}
    # 同一・数値違い
    groups_same, groups_num = collections.defaultdict(list), collections.defaultdict(list)
    for p in ps:
        groups_same[norm(p['statement']['tex'], False)].append(p['id'])
        groups_num[norm(p['statement']['tex'], True)].append(p['id'])
    same = [g for g in groups_same.values() if len(g) > 1]
    num = [g for k, g in groups_num.items() if len(g) > 1 and len({norm(byid[i]['statement']['tex'], False) for i in g}) > 1]
    sim = similar_pairs(ps)
    in_group = {i for g in same + num for i in g}
    sim = [x for x in sim if not (x[0] in in_group and x[1] in in_group)]
    print(f'問題 {len(ps)}問（公開）')
    print(f'  同一の問題文：{len(same)}組（{sum(len(g) for g in same)}問）')
    print(f'  数値だけ違う問題文：{len(num)}組（{sum(len(g) for g in num)}問）')
    print(f'  類似（4-gram の Jaccard ≥ 0.7）：{len(sim)}組')
    # 解法の結びつきごとの偏り（同じ主な解法・同じ難易度に、類似候補が集まっていないか）
    dt = ROOT / 'data' / 'techniques.json'
    main_of = {}
    if dt.exists():
        for t in json.loads(dt.read_text(encoding='utf-8'))['techniques']:
            for i in t['main']:
                main_of[i] = t['id']
    clus = collections.Counter()
    for a, b, _ in sim:
        if main_of.get(a) and main_of.get(a) == main_of.get(b) and byid[a]['level'] == byid[b]['level']:
            clus[(main_of[a], byid[a]['level'])] += 1
    if clus:
        print('  類似候補が多い「主な解法×難易度」：' + '、'.join(f'{t}・難易度{lv} {n}組' for (t, lv), n in clus.most_common(5)))
    # 品質の一覧
    rows = []
    sim_n = collections.Counter()
    for a, b, _ in sim:
        sim_n[a] += 1; sim_n[b] += 1
    for g in same + num:
        for i in g:
            sim_n[i] += 1
    auto = collections.Counter()
    for p in ps:
        sol = sum(len(s.get('tex', '')) for s in p.get('solutions', []))
        st = len(p['statement']['tex'])
        checks = {
            '解答あり': bool(p.get('answer', {}).get('tex', '').strip()),
            '解説あり': sol > 0,
            '解説の長さ（文字）': sol,
            '核となるアイデアあり': bool(p.get('idea', {}).get('tex', '').strip()),
            '入力採点の答えあり': bool(p.get('grading', {}).get('spec', '').strip()),
            'タグの数': len(p.get('tags', [])),
            '主な解法': main_of.get(p['id'], ''),
            '類似・重複の候補': sim_n.get(p['id'], 0),
            '自動検算（sympy）': p['quality'].get('checks', {}).get('sympy', False),
            '人の確認': p['quality'].get('checks', {}).get('human', False),
        }
        if not checks['解説あり']: auto['解説が無い'] += 1
        elif sol < max(60, st // 2): auto['解説が問題文の半分より短い'] += 1
        if not checks['核となるアイデアあり']: auto['核となるアイデアが無い'] += 1
        if not checks['主な解法']: auto['主な解法が決まっていない'] += 1
        if checks['類似・重複の候補']: auto['類似・重複の候補がある'] += 1
        if not checks['人の確認']: auto['人の確認がまだ'] += 1
        rows.append([p['id'], p['field'], p['level'], p.get('theme', '')] + list(checks.values()) + [''] * len(HUMAN))
    print('  自動で分かること：' + '、'.join(f'{k} {v}問' for k, v in auto.most_common()))
    if '--csv' in args:
        out = Path(args[args.index('--csv') + 1]); out.mkdir(parents=True, exist_ok=True)
        with open(out / 'similar.csv', 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f); w.writerow(['種類', '問題ID（組）', '類似度', 'テーマ'])
            for g in same: w.writerow(['同一', ' '.join(g), 1, byid[g[0]].get('theme', '')])
            for g in num: w.writerow(['数値違い', ' '.join(g), '', byid[g[0]].get('theme', '')])
            for a, b, j in sim: w.writerow(['類似', f'{a} {b}', f'{j:.2f}', f"{byid[a].get('theme', '')} ／ {byid[b].get('theme', '')}"])
        with open(out / 'quality.csv', 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f)
            w.writerow(['問題ID', '分野', '難易度', 'テーマ', '解答あり', '解説あり', '解説の長さ（文字）', '核となるアイデアあり', '入力採点の答えあり', 'タグの数', '主な解法', '類似・重複の候補', '自動検算（sympy）', '人の確認'] + [f'【人】{h}' for h in HUMAN])
            w.writerows(rows)
        print(f'  CSV を {out} に書き出しました')
    return 0


if __name__ == '__main__':
    sys.exit(main())
