#!/usr/bin/env python3
"""解法カードと問題の結びつき（主な解法・補助の解法）が崩れていないかを確かめる。

1. 主・補助の決め方（tools/build_app_data.py の select_techniques）。期待値はこのファイルに直接書く：
   主あり・補助あり／主あり・補助なし／主なし・補助あり／主なし・補助なし／自動（タグ）／
   明示の主なしと自動の主なしの区別／片方だけの指定・重複・主と同じ補助・無い解法・予約語の誤り。
   予約語（「主な解法なし」「補助の解法なし」）をカード名に使うと検査で誤り。
2. 管理表の取り込み（tools/xlsx_to_content.py）：その場で作る .xlsx で、新しい2列と、止まるべき入力（片方だけ空欄・
   旧「解法」列〈v0.29.1 から読まない〉・解法の列が無いのに content に明示の指定がある）を確かめる。
3. 書き出したデータ全体：主は1問に1つまで・主は結びつき（ids）に含まれる・nomain／manual が content の指定と一致・
   全問が規則どおり（指定のある問題は指定どおり、無い問題はタグから自動）・指定に誤りが無い・旧形式の techniques が無い。
4. 判定の記録（link_review.csv）：「誤り」で外した問題はそのカードの主に戻らない、「正しい」「新しく主に」「保留」は主のまま。
5. 管理表で指定した問題の照合（spec_check.csv）：期待する主・補助とアプリのデータ、content の指定と管理表のコピーの値。
6. タグの無いカードは指定した問題にだけ結びつく。circle-tangent は誤分類の3問に付かず、v0.29.0 の3問には補助として付く。
"""
import csv
import json
import shutil
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from build_app_data import MISSING, NO_MAIN, NO_SUPPORT, select_techniques, spec_errors, technique_spec  # noqa: E402

REVIEWS = ['docs/audit/2026-11-23/techlinks/link_review.csv', 'docs/audit/2026-11-24/tangent/link_review.csv']
SPECS = ['docs/audit/2026-11-24/spec-nomain/spec_check.csv', 'docs/audit/2026-11-24/circle-tangent/spec_check.csv',
         'docs/audit/2026-11-24/technique-split/spec_check.csv']
bad = []


def expect(cond, msg):
    if not cond:
        bad.append(msg)


# 1. 主・補助の決め方（タグ a は解法 X の主になれる、タグ b は解法 Y の補助だけ＝weak）
t2t = {'a': [('X', False)], 'b': [('Y', True)]}
tn = {'X': 'X', 'Xの名前': 'X', 'Y': 'Y', 'Z': 'Z', 'W': 'W'}
S = select_techniques
expect(S(MISSING, MISSING, ['b', 'a'], t2t, tn) == ('auto', ['Y', 'X'], ['X'], []), '自動：weak 以外の最初が主、当たった解法すべてが結びつく')
expect(S(MISSING, MISSING, ['b'], t2t, tn) == ('auto', ['Y'], [], []), '自動：weak だけなら主なし・補助あり（自動の主なし）')
expect(S('Z', ['Xの名前', 'W'], ['b'], t2t, tn) == ('manual', ['Z', 'X', 'W'], ['Z'], []), '主あり・補助あり：書いた順、タグは使わない')
expect(S('Z', [], ['a'], t2t, tn) == ('manual', ['Z'], ['Z'], []), '主あり・補助なし（明示）')
expect(S(None, ['W', 'Y'], ['a'], t2t, tn) == ('none', ['W', 'Y'], [], []), '主なし・補助あり（明示）：タグの X を主にしない')
expect(S(None, [], ['a', 'b'], t2t, tn) == ('none', [], [], []), '主なし・補助なし（明示）：タグを使わない')
expect(S(MISSING, MISSING, ['b'], t2t, tn)[0] == 'auto' and S(None, ['Y'], ['b'], t2t, tn)[0] == 'none', '自動の主なしと明示の主なしを区別できる')
for args, why in [((None, MISSING), '主だけ指定'), ((MISSING, ['W']), '補助だけ指定'), (('Z', ['Z']), '主と同じ補助'),
                  (('Z', ['W', 'W']), '補助の重複'), (('Z', ['Xの名前', 'X']), '別名で同じ補助'), (('無い解法', []), '無い主'),
                  (('Z', ['無い解法']), '無い補助'), ((NO_MAIN, []), '予約語を主の名前として'), (('Z', [NO_SUPPORT]), '予約語を補助の名前として'),
                  (('Z', 'W'), '補助が並びでない')]:
    how, ms, m, errs = S(*args, ['a'], t2t, tn)
    expect(errs, f'誤りになるべき指定（{why}）が通った')
    expect('X' not in m, f'誤った指定（{why}）でタグから主を選んだ')
expect(spec_errors({'techniques': ['X']}, tn), '旧形式の techniques が誤りにならない')

# 予約語をカードの名前に使ったら検査で誤り（一時フォルダでカードの名前を変えて確かめる）
import audit_techniques as AT  # noqa: E402
for word in (NO_MAIN, NO_SUPPORT):
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        (d / 'content').mkdir(); (d / 'data').mkdir()
        doc = json.loads((ROOT / 'content/techniques.json').read_text())
        doc['techniques'][0]['name'] = word
        (d / 'content/techniques.json').write_text(json.dumps(doc, ensure_ascii=False))
        for f in ('techniques.json', 'index.json'):
            shutil.copy(ROOT / 'data' / f, d / 'data' / f)
        E, _, _ = AT.check(d)
        expect(any(word in e for e in E), f'予約語「{word}」をカードの名前に使ったのに検査で誤りにならない')
E, _, rep = AT.check(ROOT)
expect(not E, '解法の検査の誤り：' + '／'.join(E[:3]))

# 2. 管理表の取り込み（その場で作る .xlsx）
try:
    import openpyxl
    import xlsx_to_content as XC
except ImportError:
    openpyxl = None
    print('（openpyxl が無いので、取り込みの確認は飛ばす）')


def import_rows(headers, rows, existing=None):
    """見出し（解法の列だけ）と行（ID と解法の列の値）で .xlsx を作って取り込む。戻り値：(ID → 解法の項目, 誤り)
    existing：取り込む前の content にある問題（取り込み先の上書きの確認用）"""
    tax = json.loads((ROOT / 'content/taxonomy.json').read_text())
    f0 = tax['fields'][0]
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        (d / 'content').mkdir()
        shutil.copy(ROOT / 'content/taxonomy.json', d / 'content/taxonomy.json')
        if existing:
            (d / 'content/problems').mkdir()
            (d / 'content/problems/X.json').write_text(json.dumps(existing, ensure_ascii=False))
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = '問題一覧'
        ws.append(['ID', '科目', '分野', '難易度', '問題文（LaTeX）', '答え', 'タグ', *headers])
        for pid, *vals in rows:
            ws.append([pid, f0['subject'], f0['name'], 1, 'x', 'y', 'a、b', *vals])
        wb.save(d / 't.xlsx')
        try:
            XC.convert(d / 't.xlsx', d / 'content')
        except XC.ImportFailure as e:
            return None, str(e)
        got = {}
        for f in (d / 'content/problems').glob('*.json'):
            for p in json.loads(f.read_text()):
                got[p['id']] = {k: p[k] for k in ('technique_main', 'technique_support', 'techniques') if k in p}
        return got, None


if openpyxl:
    got, err = import_rows(['主な解法', '補助の解法'], [
        ('T-1', None, None), ('T-2', 'Xの名前', 'W、Y'), ('T-3', 'Z', NO_SUPPORT), ('T-4', NO_MAIN, 'W'), ('T-5', NO_MAIN, NO_SUPPORT)])
    expect(err is None, f'新しい2列の取り込みが止まった：{err}')
    expect(got == {'T-1': {}, 'T-2': {'technique_main': 'Xの名前', 'technique_support': ['W', 'Y']},
                   'T-3': {'technique_main': 'Z', 'technique_support': []}, 'T-4': {'technique_main': None, 'technique_support': ['W']},
                   'T-5': {'technique_main': None, 'technique_support': []}}, f'新しい2列の読み方が違う：{got}')
    if got:
        res = {pid: S(*technique_spec(v), ['a', 'b'], t2t, tn) for pid, v in got.items()}
        expect(res['T-1'][:3] == ('auto', ['X', 'Y'], ['X']), '取り込み後：両方空欄は自動')
        expect(res['T-2'][:3] == ('manual', ['X', 'W', 'Y'], ['X']), '取り込み後：主あり・補助あり')
        expect(res['T-3'][:3] == ('manual', ['Z'], ['Z']), '取り込み後：主あり・補助なし')
        expect(res['T-4'][:3] == ('none', ['W'], []), '取り込み後：主なし・補助あり')
        expect(res['T-5'][:3] == ('none', [], []), '取り込み後：主なし・補助なし')
    for headers, rows, why in [(['主な解法', '補助の解法'], [('T-1', 'Z', None)], '補助だけ空欄'),
                               (['主な解法', '補助の解法'], [('T-1', None, 'W')], '主だけ空欄'),
                               (['主な解法', '補助の解法'], [('T-1', 'Z、W', 'Y')], '主に2つ'),
                               (['主な解法', '補助の解法'], [('T-1', 'Z', f'W、{NO_SUPPORT}')], '補助の予約語を並べる'),
                               (['主な解法'], [('T-1', 'Z')], '列が片方だけ'),
                               (['解法', '主な解法', '補助の解法'], [('T-1', 'Z', 'Z', NO_SUPPORT)], '新旧の列が両方'),
                               (['解法'], [('T-1', 'Z、W')], '旧「解法」列（v0.29.1 から読まない）'),
                               (['解法'], [('T-1', None)], '旧「解法」列（空欄だけでも列があれば止める）')]:
        got, err = import_rows(headers, rows)
        expect(err is not None, f'取り込みが止まるべき入力（{why}）が通った：{got}')
    spec_p = {'id': 'T-9', 'technique_main': 'Z', 'technique_support': []}
    got, err = import_rows([], [('T-1',)], existing=[spec_p])
    expect(err is not None and 'T-9' in err, f'解法の列が無いのに content の明示の指定が消える取り込みが通った：{got}')
    got, err = import_rows([], [('T-1',)], existing=[{'id': 'T-9'}])
    expect(err is None and got == {'T-1': {}}, f'解法の列が無く明示の指定も無いときの取り込みが止まった：{err}')

# 3. 書き出したデータ全体の整合
data = json.loads((ROOT / 'data/techniques.json').read_text())
index = {e['id']: e for e in json.loads((ROOT / 'data/index.json').read_text())['problems']}
main, linked = defaultdict(list), defaultdict(list)
for t in data['techniques']:
    for i in t['main']:
        main[i].append(t['id'])
    for i in t['ids']:
        linked[i].append(t['id'])
for i, ms in main.items():
    expect(len(ms) == 1, f'{i} の主な解法が {len(ms)} つある（{ms}）')
    expect(all(m in linked[i] for m in ms), f'{i} の主な解法が結びつく解法に無い')
cards = json.loads((ROOT / 'content/techniques.json').read_text())['techniques']
name2id = {x: t['id'] for t in cards for x in [t['id'], t['name'], *t.get('former', [])]}
for w in (NO_MAIN, NO_SUPPORT):
    expect(w not in name2id, f'予約語「{w}」が解法カードの ID・名前・旧 ID にある')
probs = {}
for f in (ROOT / 'content/problems').glob('*.json'):
    for p in json.loads(f.read_text()):
        if p['quality']['status'] == 'published' and p['id'] in index:
            probs[p['id']] = p
explicit = {i for i, p in probs.items() if technique_spec(p) != (MISSING, MISSING)}
expect(set(data['manual']) == explicit, '明示の指定（主か補助を書いた問題）と data の manual が合わない')
expect(set(data.get('nomain', [])) == {i for i in explicit if probs[i].get('technique_main', MISSING) is None},
       '明示の「主な解法なし」と data の nomain が合わない')
import tags as TG  # noqa: E402
cmap = TG.canonical_map(TG.load(ROOT / 'content'))
t2t, tn = {}, {}
for t in cards:
    for x in [t['id'], t['name'], *t.get('former', [])]:
        tn[x] = t['id']
    weak = {TG.to_canonical(w, cmap) for w in t.get('weak', [])}
    for tg in t['tags']:
        c = TG.to_canonical(tg, cmap)
        t2t.setdefault(c, []).append((t['id'], c in weak))
n_auto = 0
for i, p in probs.items():
    errs = spec_errors(p, tn)
    expect(not errs, f'{i}: 解法の指定の誤り {errs}')
    how, ms, m, _ = select_techniques(*technique_spec(p), index[i].get('tg', []), t2t, tn)
    expect(main.get(i, []) == m, f'{i}: 主な解法が {main.get(i, [])}（規則では {m}・{how}）')
    expect(sorted(linked.get(i, [])) == sorted(ms), f'{i}: 結びつく解法が規則と違う')
    n_auto += how == 'auto'

# 4. 判定の記録
n = 0
for rel in REVIEWS:
    for r in csv.DictReader(open(ROOT / rel, encoding='utf-8-sig')):
        n += 1
        got = (main.get(r['問題ID']) or [None])[0]
        how = r.get('対応', '外した')
        if r['判定'] == '誤り' and how.startswith('外した'):
            expect(got != r['解法ID'], f'{r["問題ID"]} が「{r["解法"]}」の主な解法に戻っている（{r["根拠"]}）')
        if r['判定'] in ('正しい', '新しく主に', '保留'):
            expect(got == r['解法ID'], f'{r["問題ID"]} の主な解法が「{r["解法"]}」でなくなった（今は {got}。判定：{r["判定"]}）')


# 5. 管理表で指定した問題の照合（v0.28.x の記録は旧「解法」列の値、v0.29.0 の記録は新しい2列の値）
def legacy_of(p):
    m, s = technique_spec(p)
    return [NO_MAIN] if m is None else [m, *(s if s is not MISSING else [])]


k, recorded = 0, set()
for rel in SPECS:
    for r in csv.DictReader(open(ROOT / rel, encoding='utf-8-sig')):
        k += 1
        i = r['問題ID']
        recorded.add(i)
        want = r['期待する主な解法ID'] if r['期待する主な解法ID'] != 'なし' else None
        sup = sorted(x for x in r['期待する補助解法ID'].split('、') if x)
        expect((main.get(i) or [None])[0] == want, f'{i}: 主な解法が {main.get(i)}（期待 {want}。{rel}）')
        expect(sorted(x for x in linked.get(i, []) if x != want) == sup, f'{i}: 補助の解法が {linked.get(i)}（期待 {sup}。{rel}）')
        p = probs.get(i, {})
        if '主な解法列' in r:
            m, s = technique_spec(p)
            expect(r['主な解法列'] == (NO_MAIN if m is None else m) and r['補助の解法列'] == ('、'.join(s) if s else NO_SUPPORT),
                   f'{i}: content の指定が管理表のコピー（{rel}）と違う')
        else:
            col = next(v for c, v in r.items() if c.startswith('管理表の解法列'))
            expect(legacy_of(p) == col.split('、'), f'{i}: content の指定が旧「解法」列の記録（{rel}）と同じ意味でない')
expect(recorded == explicit, f'明示の指定のある問題 {len(explicit)}問と spec_check.csv の問題 {len(recorded)}問が合わない')

# 6. タグの無い解法カードと circle-tangent
for t in cards:
    if t.get('tags'):
        continue
    named = {i for i in explicit if any(name2id.get(x) == t['id'] for x in
                                        [probs[i].get('technique_main'), *(probs[i].get('technique_support') or [])] if x)}
    dc = next((c for c in data['techniques'] if c['id'] == t['id']), None)
    expect(dc is not None, f'解法カード {t["id"]} が data/techniques.json に無い（再ビルドが必要）')
    expect(dc is None or set(dc['ids']) == named, f'タグの無い {t["id"]} の結びつきが「主な解法」「補助の解法」の指定と違う')
ct = next((t for t in cards if t['id'] == 'circle-tangent'), None)
expect(ct is not None, '解法カード circle-tangent が無い')
if ct:
    expect(ct['name'] == '円の接線と半径（垂直・接線の長さ）' and ct['group'] == 'geo' and ct['kind'] == 'theorem', 'circle-tangent の名前・分類・種類が違う')
    expect(ct.get('tags') == [] and not ct.get('weak'), 'circle-tangent のタグ・weak は空（タグで自動に結びつけない）')
    expect(all(str(ct.get(f, '')).strip() for f in ('summary', 'essence', 'when', 'cue', 'caution')), 'circle-tangent の必須項目が空')
    for i in ('III-INT-216', 'A-GEO-094', 'II-GEO-010'):
        expect('circle-tangent' not in linked.get(i, []), f'{i} に circle-tangent が結びついている（誤分類）')
# v0.29.0：主なしのまま、circle-tangent だけを補助に（誤りだった「接線」は外す）。期待はここに直接書く
for i in ('A-GEO-017', 'I-TRI-081', 'II-GEO-254'):
    expect(not main.get(i) and sorted(linked.get(i, [])) == ['circle-tangent'], f'{i}: 主なし・補助 circle-tangent だけのはず（今は主 {main.get(i)}・{linked.get(i)}）')
    expect(i in data.get('nomain', []) and i in data['manual'], f'{i}: 明示の「主な解法なし」として記録されていない')

for b in bad:
    print('✗', b)
print(f'判定の記録 {n}件・指定の照合 {k}行（明示の指定 {len(explicit)}問：うち主な解法なし {len(data.get("nomain", []))}）・自動 {n_auto}問・'
      + ('OK' if not bad else f'{len(bad)}件合わない'))
sys.exit(1 if bad else 0)
