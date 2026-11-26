#!/usr/bin/env python3
"""正規データ（content/）→ アプリ用データ（data/index.json と data/b/<塊>.json）

    python3 tools/build_app_data.py [content フォルダ] [data フォルダ]

本文（問題文・答え・解説など）は「問題番号20番ごとの塊」に分けて data/b/ に出す（v0.32 から。それまでは分野ごとの f-<分野ID>.json）。
  塊の名前は問題IDだけで決まる：III-DIF-374 → III-DIF-18（360〜379番）。問題を足しても非表示にしても，ほかの問題の塊は変わらない
  index.json の "bodies"：{"layout": "chunks", "dir": "b", "size": 20, "chunks": {塊: 中身のハッシュ}}
  b/*.json の "_meta": {"h": 中身のハッシュ}（一覧と合わない＝一部のファイルだけ古いことに気づくため。中身が同じなら作り直しても同じファイル）
  アプリは問題に必要な塊だけを読む（初回の8問で分野のファイルを丸ごと読まない）。"bodies" が無い一覧（--legacy の取り込み）は f-*.json を読む
本文の中身（キー）：
  "fg"（問題の図。{m: モード, e: [式], a: 答え合わせのあとか, s: manual|auto}）
  "af"（解説の中に描く答えの図の配列。[{m: モード, e: [式], v: [xmin, xmax, ymin, ymax], n: 一言, t: 見出し, f: 縦横の縮尺を別にするか}]）
  "ch"（選択式の選択肢。content/choices.json から。tools/make_choices.mjs で作る）
  index.json の "format"（データ形式の版）・"dataVersion"（中身から計算する版）・"builtinUnits"（内蔵問題の単元→分野）
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
CHUNK = 20          # 本文の塊：問題番号20番ごと
CHUNK_DIR = 'b'
_ID_NUM = re.compile(r'(.+)-(\d+)')


def chunk_of(pid, field):
    """問題の本文が入る塊の名前（js/catalog.js の chunkOf と同じ規則）。番号で終わらない ID は分野ごとの塊"""
    m = _ID_NUM.fullmatch(pid)
    return f'{m[1]}-{int(m[2]) // CHUNK}' if m else f'_{field}'


def body_hash(items):
    """塊の中身（_meta を除く）のハッシュ。キーの順に依らない"""
    return hashlib.sha1(json.dumps(items, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()[:10]


def read_bodies(data):
    """data/ の本文ファイルを読む（塊の形と，前の分野ごとの形のどちらでも）。
    戻り値：[(ファイル名 data/ からの相対, _meta, {問題ID: 本文})]"""
    data = Path(data)
    out = []
    for f in sorted((data / CHUNK_DIR).glob('*.json')) + sorted(data.glob('f-*.json')):
        d = json.loads(f.read_text(encoding='utf-8'))
        out.append((f.relative_to(data).as_posix(), d.get('_meta', {}), {k: v for k, v in d.items() if k != '_meta'}))
    return out


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



NO_MAIN = '主な解法なし'        # 管理表「主な解法」列の予約語：主な解法を明示的に空にする（content では technique_main: null）
NO_SUPPORT = '補助の解法なし'   # 管理表「補助の解法」列の予約語：補助の解法を明示的に空にする（content では technique_support: []）
RESERVED = (NO_MAIN, NO_SUPPORT)  # どちらも解法カードの ID・名前・旧 ID には使えない
MISSING = object()              # content の問題に項目が無い（＝未指定）


def technique_spec(p):
    """content の問題から (technique_main, technique_support) を取り出す。項目が無ければ MISSING。"""
    return p.get('technique_main', MISSING), p.get('technique_support', MISSING)


def select_techniques(main, support, tags, tag2tech, tname):
    """1問の解法の結びつきを決める。戻り値：(how, 結びつく解法 ID（主が先、補助は書いた順）, 主な解法 ID（0か1個）, 誤りの一覧)

    main・support は content の technique_main・technique_support（項目が無ければ MISSING）、tags は正規名にしたタグ。
      - 両方とも未指定        → how='auto'  ：タグから自動。話題だけのタグ（weak）以外で最初に当たった解法を主、当たった解法すべてを結びつける
      - 両方とも指定          → 明示の指定。タグは使わない
          main が名前・ID     → how='manual'：その解法が主
          main が None        → how='none'  ：主な解法なし（明示）
          support が並び      → 補助（書いた順）。[] は補助なし（明示）
      - 片方だけ指定          → 誤り（未指定と明示の「なし」を混ぜない）
    誤り：片方だけの指定・無い解法の名前・補助の中の重複・主と同じ解法を補助に書く・予約語を名前として使う・旧形式の techniques。
    誤りがあっても主は推測しない（main が名前として正しいときだけ主にする）。
    """
    hits = [h for t in tags for h in tag2tech.get(t, [])]
    if main is MISSING and support is MISSING:
        return 'auto', list(dict.fromkeys(m for m, _ in hits)), [m for m, w in hits if not w][:1], []
    errs = []
    if main is MISSING or support is MISSING:
        errs.append('technique_main と technique_support は両方そろえて書く（片方だけは誤り）')
    main_id = None
    if main is not MISSING and main is not None:
        if not isinstance(main, str) or main in RESERVED or main not in tname:
            errs.append(f'主な解法「{main}」が解法カードに無い')
        else:
            main_id = tname[main]
    sup_ids = []
    if support is not MISSING:
        if not isinstance(support, list):
            errs.append('technique_support は並び（リスト）で書く')
            support = []
        for x in support:
            if not isinstance(x, str) or x in RESERVED or x not in tname:
                errs.append(f'補助の解法「{x}」が解法カードに無い')
                continue
            t = tname[x]
            if t == main_id:
                errs.append(f'補助の解法「{x}」が主な解法と同じ')
            elif t in sup_ids:
                errs.append(f'補助の解法「{x}」が重複している')
            else:
                sup_ids.append(t)
    ms = ([main_id] if main_id else []) + sup_ids
    return ('manual' if main_id else 'none'), ms, ([main_id] if main_id else []), errs


def spec_errors(p, tname):
    """管理表由来の解法の指定の誤り（検査・テスト用。タグは見ない）"""
    errs = []
    if 'techniques' in p:
        errs.append('旧形式の techniques が残っている（technique_main・technique_support に移す）')
    errs += select_techniques(*technique_spec(p), [], {}, tname)[3]
    return errs


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
            if x in RESERVED:
                sys.exit(f'解法カード {t["id"]} の ID・名前・旧 ID に予約語「{x}」は使えません')
            tname[x] = t['id']
        weak = {TG.to_canonical(w, cmap) for w in t.get('weak', [])}
        for tg in t['tags']:
            c = TG.to_canonical(tg, cmap)
            tag2tech.setdefault(c, []).append((t['id'], c in weak))
    tech_ids = {t['id']: [] for t in techs}
    tech_main = {t['id']: [] for t in techs}
    manual, nomain, bad_tech, links = [], [], [], {}
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
        # 答えの図：管理表の「答えの図」列（解説の中に描く）
        afgs = p.get('answer_figures')
        if afgs:
            b['af'] = [{'m': f['mode'], 'e': f['exprs'], **({'v': f['view']} if f.get('view') else {}), **({'n': f['note']} if f.get('note') else {}),
                        **({'t': f['title']} if f.get('title') else {}), **({'f': 1} if f.get('free_aspect') else {})} for f in afgs]
        # 頻出度：管理表の「頻出度」列、なければ判定済みのもの（問題文が同じときだけ）。2（中）は書かない
        v = p.get('value')
        if not v:
            jv = values.get(p['id'])
            if jv and jv['h'] == hashlib.sha1(p['statement']['tex'].encode('utf-8')).hexdigest()[:12]:
                v = jv['v']
        if v and v != 2:
            e['v'] = v
        # 解法：管理表の「主な解法」「補助の解法」列（select_techniques を参照）
        how, ms, main, errs = select_techniques(*technique_spec(p), e.get('tg', []), tag2tech, tname)
        if 'techniques' in p:
            errs = ['旧形式の techniques が残っている（technique_main・technique_support に移す）'] + errs
        bad_tech += [f"{p['id']}: {x}" for x in errs]
        if how != 'auto':
            manual.append(p['id'])      # 明示の指定（主な解法なしも含む）。画面の「（自動）」の表示に使う
        if how == 'none':
            nomain.append(p['id'])      # 明示の「主な解法なし」
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
        bodies.setdefault(chunk_of(p['id'], p['field']), {})[p['id']] = b
    used = {e['f'] for e in index}
    fields = [{'key': f['key'], 'subject': f['subject'], 'name': f['name']}
              for f in sorted(tax['fields'], key=lambda f: f['order']) if f['key'] in used]
    hashes = {key: body_hash(items) for key, items in sorted(bodies.items())}
    idx = {'format': FORMAT, 'dataVersion': version, 'generated': meta['generated'], 'source': meta['source'],
           'count': len(index), 'fields': fields, 'builtinUnits': tax.get('builtinUnits', {}),
           'bodies': {'layout': 'chunks', 'dir': CHUNK_DIR, 'size': CHUNK, 'chunks': hashes}, 'problems': index}
    out.mkdir(parents=True, exist_ok=True)
    for old in list(out.glob('f-*.json')) + list((out / CHUNK_DIR).glob('*.json')):
        old.unlink()
    (out / CHUNK_DIR).mkdir(exist_ok=True)
    (out / 'index.json').write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for key, items in bodies.items():
        b = {'_meta': {'h': hashes[key]}, **items}
        (out / CHUNK_DIR / f'{key}.json').write_text(json.dumps(b, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
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
                                                     'manual': sorted(manual), 'nomain': sorted(nomain), 'techniques': tout},
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
        print('  解法の指定の誤り', b)
    if r['unknown']:
        print('文章中の未対応命令（名前だけ表示）:', ', '.join(r['unknown']))
    for w in r['warn'][:50]:
        print('  注意', w)


if __name__ == '__main__':
    main()
