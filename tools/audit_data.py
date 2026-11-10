#!/usr/bin/env python3
"""データの監査。アプリ用データ（data/）・正規データ（content/）・内蔵問題（js/content.js）が
壊れていないか、問題ID が消えていないか、非公開の情報が漏れていないかを調べる。

    python3 tools/audit_data.py                     いつもの検査（CI でも実行）
    python3 tools/audit_data.py --xlsx 管理表.xlsx   非公開の列（参考元・メモ）が公開ファイルに漏れていないかも調べる（手元のみ）
    python3 tools/audit_data.py --write-golden      問題ID の台帳 tests/golden/ids.txt・hidden.txt を今のデータで作り直す
    オプション --report reports/audit.md で、警告の件数をファイルにも書く

エラーが1件でもあれば終了コード 1。警告（欠けている任意項目の件数など）は数えるだけ。
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA, CONTENT, GOLDEN = ROOT / 'data', ROOT / 'content', ROOT / 'tests' / 'golden'
BUILTIN_ID = re.compile(r'^q\d+$')


def builtin_ids():
    src = (ROOT / 'js' / 'content.js').read_text(encoding='utf-8')
    body = src[src.index('export const PROBLEMS'):]
    return re.findall(r"\{\s*id:\s*'([^']+)',\s*cards:", body)


def load_data():
    idx = json.loads((DATA / 'index.json').read_text(encoding='utf-8'))
    bodies, where = {}, {}
    for f in sorted(DATA.glob('f-*.json')):
        d = json.loads(f.read_text(encoding='utf-8'))
        for k, v in d.items():
            if k == '_meta':
                continue
            if k in bodies:
                where.setdefault(k, [where.get(k)]).append(f.name)
            bodies[k] = (f.stem[2:], v, d.get('_meta', {}).get('dataVersion'))
            where.setdefault(k, f.name)
    return idx, bodies


def load_content():
    out = []
    pdir = CONTENT / 'problems'
    if not pdir.exists():
        return None
    for f in sorted(pdir.glob('*.json')):
        for p in json.loads(f.read_text(encoding='utf-8')):
            out.append((f.stem, p))
    return out


def audit(xlsx=None):
    E, W = [], Counter()
    idx, bodies = load_data()
    ids = [e['id'] for e in idx['problems']]
    fields = {f['key'] for f in idx['fields']}
    bids = builtin_ids()

    # 1. ID の重複・内蔵問題との衝突
    for i, n in Counter(ids).items():
        if n > 1:
            E.append(f'ID の重複（data/index.json）: {i} が {n}件')
    for i, n in Counter(bids).items():
        if n > 1:
            E.append(f'ID の重複（js/content.js）: {i} が {n}件')
    for i in set(ids) & set(bids):
        E.append(f'管理表の問題と内蔵問題で ID が同じ: {i}')
    for i in ids:
        if BUILTIN_ID.match(i):
            E.append(f'管理表の問題に内蔵問題用の ID（q+数字）が使われている: {i}')

    # 2. 一覧と本文の一致・分野・難易度
    for e in idx['problems']:
        if e['f'] not in fields:
            E.append(f'{e["id"]}: 分野 {e["f"]} が fields にない')
        if e['id'] not in bodies:
            E.append(f'{e["id"]}: 本文（f-{e["f"]}.json）がない')
        elif bodies[e['id']][0] != e['f']:
            E.append(f'{e["id"]}: 一覧の分野 {e["f"]} と本文のファイル f-{bodies[e["id"]][0]}.json が違う')
        if not isinstance(e.get('lv'), int) or not 0 <= e['lv'] <= 5:
            E.append(f'{e["id"]}: 難易度 {e.get("lv")} が 0〜5 でない')
        if 't' in e and (not isinstance(e['t'], int) or e['t'] <= 0):
            E.append(f'{e["id"]}: 想定時間 {e["t"]} が正の整数でない')
        if bool(e.get('in')) != bool(bodies.get(e['id'], (0, {}))[1].get('in')):
            E.append(f'{e["id"]}: 一覧の in と本文の in が合わない')
        for k, name in [('t', '想定時間'), ('th', 'テーマ'), ('tg', 'タグ'), ('in', '入力用の答え')]:
            if not e.get(k):
                W[f'{name}がない問題'] += 1
        b = bodies.get(e['id'], (0, {}))[1]
        if not b.get('k'):
            W['核となるアイデアがない問題'] += 1
        if not b.get('s'):
            W['解説がない問題'] += 1
    for k in set(bodies) - set(ids):
        E.append(f'{k}: 本文はあるが一覧（index.json）にない')
    if idx.get('count') != len(ids):
        E.append(f'index.json の count {idx.get("count")} と問題数 {len(ids)} が違う')

    # 3. データの版（新しい形式のときだけ）
    if 'dataVersion' in idx:
        vs = {v for (_, _, v) in bodies.values()}
        if vs != {idx['dataVersion']}:
            E.append(f'dataVersion が揃っていない: index.json {idx["dataVersion"]}、f-*.json {sorted(map(str, vs))}')

    # 4. 正規データとの整合
    content = load_content()
    hidden = set()
    if content is not None:
        tax = json.loads((CONTENT / 'taxonomy.json').read_text(encoding='utf-8'))
        tkeys = [f['key'] for f in tax['fields']]
        if len(set(tkeys)) != len(tkeys):
            E.append('taxonomy.json に同じ分野ID が2回ある')
        names = Counter((f['subject'], f['name']) for f in tax['fields'])
        for n, c in names.items():
            if c > 1:
                E.append(f'taxonomy.json に同じ分野名が2回ある: {n}')
        for f in idx['fields']:
            t = next((x for x in tax['fields'] if x['key'] == f['key']), None)
            if not t or (t['subject'], t['name']) != (f['subject'], f['name']):
                E.append(f'分野 {f["key"]} が taxonomy.json と index.json で違う')
        cids = Counter(p['id'] for _, p in content)
        for i, n in cids.items():
            if n > 1:
                E.append(f'ID の重複（content/）: {i} が {n}件')
        for stem, p in content:
            if stem != 'builtin' and p['field'] != stem:
                E.append(f'{p["id"]}: content/problems/{stem}.json にあるが field は {p["field"]}')
            if p['quality']['status'] == 'hidden':
                hidden.add(p['id'])
            for iss in p['quality'].get('issues', []):
                W[f'正規データの注意 {iss}'] += 1
        published = {p['id'] for s, p in content if s != 'builtin' and p['quality']['status'] == 'published'}
        if published != set(ids):
            E.append(f'content/ の公開問題と data/ の問題が合わない（content のみ {len(published - set(ids))}件、'
                     f'data のみ {len(set(ids) - published)}件）→ python3 tools/build_app_data.py で作り直す')
        builtin_c = {p['id'] for s, p in content if s == 'builtin'}
        if builtin_c and builtin_c != set(bids):
            E.append('content/problems/builtin.json が js/content.js と合わない → node tools/builtin_to_content.mjs')
        for u, k in tax.get('builtinUnits', {}).items():
            if k not in tkeys:
                E.append(f'taxonomy.json の builtinUnits {u} → {k} が分野にない')

    # 4b. 問題セット・検索の索引・タグ辞書
    if content is not None:
        allc = {p['id'] for _, p in content}
        for f in sorted((CONTENT / 'collections').glob('*.json')) if (CONTENT / 'collections').exists() else []:
            c = json.loads(f.read_text(encoding='utf-8'))
            if f.stem != c.get('id'):
                E.append(f'問題セット {f.name}: ファイル名と id（{c.get("id")}）が違う')
            for it in c.get('items', []):
                if it['id'] not in allc:
                    E.append(f'問題セット {c.get("id")}: 問題 {it["id"]} が無い')
                elif it['id'] in hidden:
                    W['問題セットに入っている非表示の問題'] += 1
        tg = CONTENT / 'tags.json'
        if tg.exists():
            seen = {}
            for t in json.loads(tg.read_text(encoding='utf-8'))['tags']:
                for s2 in [t['name']] + t.get('aliases', []):
                    k = re.sub(r'[・･\s、,／/()（）「」\-−ー~〜]', '', __import__('unicodedata').normalize('NFKC', s2).lower())
                    if k in seen and seen[k] != t['name']:
                        E.append(f'タグ辞書：「{s2}」が「{seen[k]}」と「{t["name"]}」の両方にある')
                    seen[k] = t['name']
    for name in ('search.json', 'collections.json'):
        f = DATA / name
        if 'dataVersion' in idx and f.exists():
            v = json.loads(f.read_text(encoding='utf-8')).get('dataVersion')
            if v != idx['dataVersion']:
                E.append(f'data/{name} の dataVersion {v} が index.json と違う')
    sf = DATA / 'search.json'
    if sf.exists():
        sids = [i for i, _ in json.loads(sf.read_text(encoding='utf-8'))['items']]
        if set(sids) != set(ids):
            E.append(f'検索の索引（data/search.json）と問題一覧が合わない（{len(set(sids) ^ set(ids))}件）')

    # 5. 問題ID の台帳（消えた ID がないか）
    golden = GOLDEN / 'ids.txt'
    if golden.exists():
        known = set(ids) | set(bids) | hidden
        hfile = GOLDEN / 'hidden.txt'
        listed_hidden = set(hfile.read_text(encoding='utf-8').split()) if hfile.exists() else set()
        for i in golden.read_text(encoding='utf-8').split():
            if i not in known:
                E.append(f'問題ID が消えた: {i}（台帳 tests/golden/ids.txt にある）'
                         + ('。非表示にしたなら content/ に status "hidden" で残す' if i not in listed_hidden else ''))
    else:
        W['問題ID の台帳がない（--write-golden で作る）'] += 1

    # 6. 非公開の列が公開ファイルに漏れていないか（Excel を渡したときだけ）
    if xlsx:
        E += leak_check(xlsx)
    return E, W, {'ids': ids, 'builtin': bids, 'hidden': sorted(hidden)}


def leak_check(xlsx):
    import openpyxl
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb['問題一覧']
    head = [str(c or '').strip() for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    cols = [n for n, h in enumerate(head) if h in ('参考元（非公開）', 'メモ')]
    values = set()
    for r in ws.iter_rows(min_row=2, values_only=True):
        for c in cols:
            v = str(r[c] or '').strip()
            # 短すぎる値・定型文（同じ文が多数の行にある）は誤検出になるので外す
            if len(v) >= 12:
                values.add(v)
    common = {'O列：SymPy／数値計算で答えを照合済み'}
    targets = [p for p in list(DATA.rglob('*.json')) + list(CONTENT.rglob('*.json')) + list((ROOT / 'js').glob('*.js'))]
    blob = '\n'.join(p.read_text(encoding='utf-8') for p in targets)
    bad = [v for v in values if not any(v.startswith(c) for c in common) and v in blob]
    return [f'非公開の列の文字列が公開ファイルにある: 「{v[:40]}」' for v in sorted(bad)[:20]]


def main():
    argv = sys.argv[1:]
    xlsx = argv[argv.index('--xlsx') + 1] if '--xlsx' in argv else None
    E, W, info = audit(xlsx)
    if '--write-golden' in argv:
        GOLDEN.mkdir(parents=True, exist_ok=True)
        allids = sorted(set(info['ids']) | set(info['builtin']) | set(info['hidden']))
        (GOLDEN / 'ids.txt').write_text('\n'.join(allids) + '\n', encoding='utf-8')
        (GOLDEN / 'hidden.txt').write_text('\n'.join(info['hidden']) + ('\n' if info['hidden'] else ''), encoding='utf-8')
        print(f'台帳を書きました：{len(allids)}件（非表示 {len(info["hidden"])}件）')
        E, W, info = audit(xlsx)
    lines = [f'# データ監査', '', f'- 問題（管理表）: {len(info["ids"])}問', f'- 内蔵問題: {len(info["builtin"])}問',
             f'- 非表示: {len(info["hidden"])}問', f'- エラー: {len(E)}件', '', '## 警告（件数）', '']
    lines += [f'- {k}: {v}' for k, v in sorted(W.items())] or ['- なし']
    if E:
        lines += ['', '## エラー', ''] + [f'- {e}' for e in E]
    text = '\n'.join(lines) + '\n'
    if '--report' in argv:
        rp = ROOT / argv[argv.index('--report') + 1]
        rp.parent.mkdir(parents=True, exist_ok=True)
        rp.write_text(text, encoding='utf-8')
    print(text)
    sys.exit(1 if E else 0)


if __name__ == '__main__':
    main()
