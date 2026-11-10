#!/usr/bin/env python3
"""正規データ（content/）→ アプリ用データ（data/index.json と data/f-<分野ID>.json）

    python3 tools/build_app_data.py [content フォルダ] [data フォルダ]

出力の形は v0.6 までと同じ（アプリは今の catalog.js のまま読める）。足したもの：
  index.json の "format"（データ形式の版）・"dataVersion"（中身から計算する版）・"builtinUnits"（内蔵問題の単元→分野）
  f-*.json の "_meta": {"dataVersion"}（一部のファイルだけ古いときに気づくため）
  タグはタグ辞書（content/tags.json）の正規名に置き換えて出す
  search.json（検索用の索引）・collections.json（問題セット）
quality.status が "hidden" の問題は出さない。
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from latex_html import WARN, render  # noqa: E402
import tags as TG  # noqa: E402
import re  # noqa: E402

FORMAT = 'lemma.data/1'


def load_content(content):
    content = Path(content)
    tax = json.loads((content / 'taxonomy.json').read_text(encoding='utf-8'))
    meta = json.loads((content / 'meta.json').read_text(encoding='utf-8'))
    order = {f['key']: f['order'] for f in tax['fields']}
    files = sorted((p for p in (content / 'problems').glob('*.json') if p.name != 'builtin.json'),
                   key=lambda p: order.get(p.stem, 10 ** 6))
    problems = []
    for p in files:
        problems += json.loads(p.read_text(encoding='utf-8'))
    return tax, meta, problems, files


def data_version(files, tax_path):
    h = hashlib.sha256()
    extra = [tax_path.parent / 'tags.json'] + sorted((tax_path.parent / 'collections').glob('*.json'))
    for p in [tax_path] + list(files) + [x for x in extra if x.exists()]:
        h.update(p.name.encode())
        h.update(p.read_bytes())
    return h.hexdigest()[:12]


MATH = re.compile(r'\$\$.*?\$\$|\$[^$]*\$|\\\[.*?\\\]', re.S)


def plain(tex):
    """検索用の平文：数式は関数名だけ残し、命令・記号を除く"""
    def keep(m):
        return ' ' + ' '.join(re.findall(r'\\(sin|cos|tan|log|int|sum|lim|sqrt)', m.group(0))) + ' '
    t = MATH.sub(keep, str(tex or ''))
    t = re.sub(r'\\(begin|end)\{[^}]*\}|\\item|\\[a-zA-Z]+', ' ', t)
    return re.sub(r'[{}\\&]', ' ', t)


def entry_and_body(p, unknown):
    ctx = {'id': p['id'], 'unknown': unknown}
    e = {'id': p['id'], 'f': p['field'], 'lv': p['level']}
    if p.get('minutes'):
        e['t'] = p['minutes']
    if p.get('theme'):
        e['th'] = render(p['theme'], ctx)
    if p.get('tags'):
        e['tg'] = p['tags']   # build() で正規名に置き換える
    if p['quality'].get('verified'):
        e['ok'] = 1
    sol = p['solutions'][0]['tex'] if p.get('solutions') else ''
    b = {'q': render(p['statement']['tex'], ctx), 'a': render(p['answer']['tex'], ctx),
         's': render(sol, ctx), 'k': render(p['idea']['tex'] if p.get('idea') else '', ctx)}
    if p.get('grading', {}).get('format') == 'lemma-input/1':
        b['in'] = p['grading']['spec']
        e['in'] = 1
    return e, b


def builtin_ids(content):
    p = Path(content) / 'problems' / 'builtin.json'
    return {x['id'] for x in json.loads(p.read_text(encoding='utf-8'))} if p.exists() else set()


def build(content=ROOT / 'content', out=ROOT / 'data'):
    content, out = Path(content), Path(out)
    tax, meta, problems, files = load_content(content)
    version = data_version(files, content / 'taxonomy.json')
    unknown = set()
    tagdict = TG.load(content)
    cmap = TG.canonical_map(tagdict) if tagdict else {}
    alias = {t['name']: t.get('aliases', []) for t in tagdict['tags']} if tagdict else {}
    fname = {f['key']: f['name'] for f in tax['fields']}
    index, bodies, hidden, search = [], {}, 0, []
    for p in problems:
        if p['quality']['status'] != 'published':
            hidden += 1
            continue
        e, b = entry_and_body(p, unknown)
        if e.get('tg'):
            e['tg'] = list(dict.fromkeys(TG.to_canonical(t, cmap) for t in e['tg']))
        words = [p.get('theme', ''), fname.get(p['field'], '')] + e.get('tg', []) + [a for t in e.get('tg', []) for a in alias.get(t, [])]
        search.append([p['id'], TG.norm(plain(' '.join(words)) + ' ' + plain(p['statement']['tex']))])
        index.append(e)
        bodies.setdefault(p['field'], {'_meta': {'dataVersion': version}})[p['id']] = b
    fields = [{'key': f['key'], 'subject': f['subject'], 'name': f['name']}
              for f in sorted(tax['fields'], key=lambda f: f['order']) if f['key'] in bodies]
    idx = {'format': FORMAT, 'dataVersion': version, 'generated': meta['generated'], 'source': meta['source'],
           'count': len(index), 'fields': fields, 'builtinUnits': tax.get('builtinUnits', {}), 'problems': index}
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('f-*.json'):
        old.unlink()
    (out / 'index.json').write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for key, b in bodies.items():
        (out / f'f-{key}.json').write_text(json.dumps(b, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    # 検索用の索引：[ID, 比較用に正規化した文字列]（テーマ・分野名・タグと別名・問題文の文章部分）
    (out / 'search.json').write_text(json.dumps({'dataVersion': version, 'items': search}, ensure_ascii=False,
                                                separators=(',', ':')), encoding='utf-8')
    # 問題セット：公開中の問題だけを残す
    ids = {e['id'] for e in index} | builtin_ids(content)
    cols = []
    for f in sorted((content / 'collections').glob('*.json')) if (content / 'collections').exists() else []:
        c = json.loads(f.read_text(encoding='utf-8'))
        if c.get('visibility', 'public') == 'private':
            continue
        items = [it for it in c['items'] if it['id'] in ids]
        if items:
            cols.append({k: v for k, v in {**c, 'items': items}.items() if k != 'schema'})
    cols.sort(key=lambda c: (c.get('order', 10 ** 6), c['id']))
    (out / 'collections.json').write_text(json.dumps({'dataVersion': version, 'collections': cols}, ensure_ascii=False,
                                                     separators=(',', ':')), encoding='utf-8')
    return {'collections': len(cols), 'count': len(index), 'fields': len(fields), 'hidden': hidden, 'auto': sum(1 for e in index if e.get('in')),
            'dataVersion': version, 'unknown': sorted(unknown), 'warn': list(WARN)}


def main():
    args = sys.argv[1:]
    r = build(args[0] if args else ROOT / 'content', args[1] if len(args) > 1 else ROOT / 'data')
    print(f"{r['count']}問を書き出しました（{r['fields']}分野、入力して採点できる問題 {r['auto']}問、"
          f"非表示 {r['hidden']}問、dataVersion {r['dataVersion']}）")
    if r['unknown']:
        print('文章中の未対応命令（名前だけ表示）:', ', '.join(r['unknown']))
    for w in r['warn'][:50]:
        print('  注意', w)


if __name__ == '__main__':
    main()
