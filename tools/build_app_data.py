#!/usr/bin/env python3
"""正規データ（content/）→ アプリ用データ（data/index.json と data/f-<分野ID>.json）

    python3 tools/build_app_data.py [content フォルダ] [data フォルダ]

出力の形は v0.6 までと同じ（アプリは今の catalog.js のまま読める）。足したもの：
  f-*.json の "fg"（問題の図。{m: モード, e: [式], a: 答え合わせのあとか, s: manual|auto}）
  f-*.json の "ch"（選択式の選択肢。content/choices.json から。tools/make_choices.mjs で作る）
  index.json の "format"（データ形式の版）・"dataVersion"（中身から計算する版）・"builtinUnits"（内蔵問題の単元→分野）
  f-*.json の "_meta": {"dataVersion"}（一部のファイルだけ古いときに気づくため）
  タグはタグ辞書（content/tags.json）の正規名に置き換えて出す
  search.json（検索用の索引）・collections.json（問題セット）・techniques.json（解法カードと結びつく問題）
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
    extra = [tax_path.parent / 'tags.json', tax_path.parent / 'choices.json', tax_path.parent / 'figures.json', tax_path.parent / 'values.json', tax_path.parent / 'techniques.json'] + sorted((tax_path.parent / 'collections').glob('*.json'))
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


AFTER = re.compile(r'図示|概形|グラフを(?:かけ|描け|書け|かき|描き)|図に(?:示|かけ)|領域を(?:求め|図)|軌跡|どのような(?:図形|曲線|直線|円|線|領域)|どんな(?:図形|曲線|直線)|表す図形|描く図形|えがく図形')   # figure_candidates.py と同じ


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
    cpath = content / 'choices.json'
    choices = json.loads(cpath.read_text(encoding='utf-8')) if cpath.exists() else {}
    fpath = content / 'figures.json'
    figures = json.loads(fpath.read_text(encoding='utf-8')) if fpath.exists() else {}
    vpath = content / 'values.json'
    values = json.loads(vpath.read_text(encoding='utf-8')) if vpath.exists() else {}
    tpath = content / 'techniques.json'
    tdoc = json.loads(tpath.read_text(encoding='utf-8')) if tpath.exists() else {'groups': [], 'techniques': []}
    techs = tdoc['techniques']
    tag2tech, tname = {}, {}   # タグ（正規名）→ [(解法 ID, 補助だけか)]、名前・ID・旧 ID → 解法 ID
    for t in techs:
        for x in [t['id'], t['name'], *t.get('former', [])]:
            tname[x] = t['id']
        weak = {TG.to_canonical(w, cmap) for w in t.get('weak', [])}
        for tg in t['tags']:
            c = TG.to_canonical(tg, cmap)
            tag2tech.setdefault(c, []).append((t['id'], c in weak))
    tech_ids = {t['id']: [] for t in techs}
    tech_main = {t['id']: [] for t in techs}
    manual, bad_tech, links = [], [], {}
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
        # 問題の図：管理表の「図の式」（手書き）があればそれ、なければ問題文から自動で取り出したもの（問題文が同じときだけ）
        fg = p.get('figure')
        if fg:
            after = fg.get('after')
            if after is None:
                after = bool(AFTER.search(p['statement']['tex']))
            b['fg'] = {'m': fg['mode'], 'e': fg['exprs'], 'a': 1 if after else 0, 's': 'manual'}
        else:
            af = figures.get(p['id'])
            if af and af['h'] == hashlib.sha1(p['statement']['tex'].encode('utf-8')).hexdigest()[:12]:
                b['fg'] = {'m': af['mode'], 'e': af['exprs'], 'a': 1 if af['after'] else 0, 's': 'auto'}
        # 頻出度：管理表の「頻出度」列、なければ判定済みのもの（問題文が同じときだけ）。2（中）は書かない
        v = p.get('value')
        if not v:
            jv = values.get(p['id'])
            if jv and jv['h'] == hashlib.sha1(p['statement']['tex'].encode('utf-8')).hexdigest()[:12]:
                v = jv['v']
        if v and v != 2:
            e['v'] = v
        # 解法：管理表の「解法」列があればそれだけ（先頭が主な解法）。なければタグから自動で：
        # 話題だけのタグ（weak）以外で最初に当たった解法を主、残りを補助とする
        if p.get('techniques'):
            ms = []
            for x in p['techniques']:
                if x in tname:
                    ms.append(tname[x])
                else:
                    bad_tech.append(f"{p['id']}: {x}")
            ms = list(dict.fromkeys(ms))
            main = ms[:1]
            manual.append(p['id'])
        else:
            hits = [h for t in e.get('tg', []) for h in tag2tech.get(t, [])]
            ms = list(dict.fromkeys(m for m, _ in hits))
            main = [m for m, w in hits if not w][:1]
        for m in ms:
            tech_ids[m].append(p['id'])
        for m in main:
            tech_main[m].append(p['id'])
        if ms:
            links[p['id']] = ms
        ch = choices.get(p['id'])
        if ch and b.get('in') == ch['spec']:
            b['ch'] = ch['f']      # 選択式の選択肢（欄の順。先頭が正解、表示のときに混ぜる。null の欄は入力式）
            e['ch'] = 1
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
    # 解法カード：カードの内容と、結びつく問題の ID（難易度の低い順）
    lv = {e['id']: e['lv'] for e in index}
    # よく一緒に結びつく解法（同じ問題に結びつく回数。5問以上のものを多い順に3つまで）
    co = {t['id']: {} for t in techs}
    for ms in links.values():
        for a in ms:
            for b in ms:
                if a != b:
                    co[a][b] = co[a].get(b, 0) + 1
    srt = lambda ids: sorted(ids, key=lambda i: (lv[i], i))
    tout = [{**{k: v for k, v in t.items() if k not in ('tags', 'weak')}, 'ids': srt(tech_ids[t['id']]), 'main': srt(tech_main[t['id']]),
             'with': [[b, n] for b, n in sorted(co[t['id']].items(), key=lambda x: -x[1]) if n >= 5][:3]} for t in techs]
    (out / 'techniques.json').write_text(json.dumps({'dataVersion': version, 'groups': tdoc['groups'], 'kinds': tdoc.get('kinds', []),
                                                     'manual': sorted(manual), 'techniques': tout},
                                                    ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return {'techniques': len(techs), 'tech_linked': len(links), 'tech_main': len({i for v in tech_main.values() for i in v}), 'bad_tech': bad_tech,
            'collections': len(cols), 'count': len(index), 'choice': sum(1 for e in index if e.get('ch')), 'fields': len(fields), 'hidden': hidden, 'auto': sum(1 for e in index if e.get('in')),
            'dataVersion': version, 'unknown': sorted(unknown), 'warn': list(WARN)}


def main():
    args = sys.argv[1:]
    r = build(args[0] if args else ROOT / 'content', args[1] if len(args) > 1 else ROOT / 'data')
    print(f"{r['count']}問を書き出しました（{r['fields']}分野、入力して採点できる問題 {r['auto']}問、"
          f"非表示 {r['hidden']}問、dataVersion {r['dataVersion']}）")
    print(f"解法カード {r['techniques']}枚（結びつく問題 {r['tech_linked']}問・うち主な解法がある {r['tech_main']}問）")
    for b in r['bad_tech']:
        print('  解法の名前が見つかりません', b)
    if r['unknown']:
        print('文章中の未対応命令（名前だけ表示）:', ', '.join(r['unknown']))
    for w in r['warn'][:50]:
        print('  注意', w)


if __name__ == '__main__':
    main()
