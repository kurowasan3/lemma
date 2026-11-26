#!/usr/bin/env python3
"""本文の置き方（塊 b/*.json・前の形 f-*.json）に対する監査ツールの異常系テスト。
壊したデータを作って，compare_data・check_answers・build_dist・validate_new・load_bodies_checked が
「一部だけを見て成功」しないこと，塊の配置の違いを中身の変更と誤認しないことを確かめる。"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import build_app_data as BA  # noqa: E402
import compare_data as CD  # noqa: E402
import build_dist as BD  # noqa: E402

passed = failed = 0


def ok(c, m):
    global passed, failed
    if c:
        passed += 1
    else:
        failed += 1
        print('  FAIL ' + m)


TMP = Path(tempfile.mkdtemp(prefix='lemma-datatools-'))
DATA = ROOT / 'data'


def copy(name):
    d = TMP / name
    shutil.copytree(DATA, d)
    return d


def to_legacy(src, name):
    """塊の data/ から前の形（分野ごとの f-*.json・index に bodies なし）を作る"""
    d = TMP / name
    d.mkdir()
    idx = json.loads((src / 'index.json').read_text(encoding='utf-8'))
    field = {e['id']: e['f'] for e in idx['problems']}
    out = {}
    for _, _, items in BA.read_bodies(src):
        for k, v in items.items():
            out.setdefault(field[k], {'_meta': {'dataVersion': idx['dataVersion']}})[k] = v
    for f, b in out.items():
        (d / f'f-{f}.json').write_text(json.dumps(b, ensure_ascii=False), encoding='utf-8')
    idx.pop('bodies')
    (d / 'index.json').write_text(json.dumps(idx, ensure_ascii=False), encoding='utf-8')
    for x in ('search.json', 'collections.json', 'techniques.json'):
        shutil.copy2(src / x, d / x)
    return d


def edit_body(d, pid, key, fn, rehash=True):
    """塊の本文を書き換える（rehash=True ならハッシュも直す＝正しく作り直したのと同じ）"""
    idx = json.loads((d / 'index.json').read_text(encoding='utf-8'))
    e = next(x for x in idx['problems'] if x['id'] == pid)
    key_c = BA.chunk_of(pid, e['f'])
    p = d / 'b' / f'{key_c}.json'
    b = json.loads(p.read_text(encoding='utf-8'))
    fn(b[pid]) if key is None else b[pid].__setitem__(key, fn(b[pid][key]))
    if rehash:
        items = {k: v for k, v in b.items() if k != '_meta'}
        b['_meta']['h'] = idx['bodies']['chunks'][key_c] = BA.body_hash(items)
        (d / 'index.json').write_text(json.dumps(idx, ensure_ascii=False), encoding='utf-8')
    p.write_text(json.dumps(b, ensure_ascii=False), encoding='utf-8')
    return key_c


# ---------- 塊の決まり方 ----------
ok(BA.chunk_of('III-DIF-019', 'x') == 'III-DIF-0' and BA.chunk_of('III-DIF-020', 'x') == 'III-DIF-1'
   and BA.chunk_of('III-DIF-39', 'x') == 'III-DIF-1' and BA.chunk_of('III-DIF-40', 'x') == 'III-DIF-2', '20番ごとの境界（19→0, 20→1, 39→1, 40→2）')
ok(BA.chunk_of('A-B-C-0019', 'I-01') == 'A-B-C-0' and BA.chunk_of('NONUM', 'I-01') == '_I-01', 'ハイフンの多い ID・番号の無い ID')
ok(BA.chunk_of('III-DIF-１２', 'I-01') == '_I-01', '全角の数字は番号とみなさない（アプリの \\d と同じ）')
ok(BA.nat_key('III-DIF-9') < BA.nat_key('III-DIF-10'), '問題IDの自然な順')

# ---------- load_bodies_checked：今のデータは全問そろう ----------
idx, bodies, errs = BA.load_bodies_checked(DATA)
ok(not errs and len(bodies) == len(idx['problems']) == idx['count'], f'今の data/：全 {len(bodies)}問の本文がちょうど1つずつ（{errs[:3]}）')

# ---------- compare_data の12の場合 ----------
NEW = copy('new')
OLD = to_legacy(DATA, 'old')
r = CD.compare(OLD, to_legacy(DATA, 'old2'))
ok(CD.report(r), '1. 旧形式どうし：一致')
r = CD.compare(DATA, NEW)
ok(CD.report(r), '2. 新形式どうし：一致')
r = CD.compare(OLD, NEW)
ok(CD.report(r) and not r['changed'], '3・4. 旧形式と新形式：置き場所の違いを中身の変更と誤認しない（一致）')
d5 = copy('q')
edit_body(d5, 'III-DIF-374', 'q', lambda v: v + 'X')
r = CD.compare(DATA, d5)
ok(r['changed'] == [('III-DIF-374', '本文', ['q'])] and not r['broken'], f'5. 問題文だけ違う：III-DIF-374 の q（{r["changed"][:2]}）')
d6 = copy('a')
edit_body(d6, 'B-SEQ-342', 'a', lambda v: v + 'X')
r = CD.compare(OLD, d6)
ok(r['changed'] == [('B-SEQ-342', '本文', ['a'])], '6. 答えだけ違う（旧形式と比べても）')
d7 = copy('s')
edit_body(d7, 'A-COM-020', 's', lambda v: v + 'X')
r = CD.compare(d7, DATA)
ok(r['changed'] == [('A-COM-020', '本文', ['s'])], '7. 解説だけ違う')
d8 = copy('add')
idx8 = json.loads((d8 / 'index.json').read_text(encoding='utf-8'))
src = next(e for e in idx8['problems'] if e['id'] == 'III-DIF-374')
idx8['problems'].append({**src, 'id': 'III-DIF-999'})
idx8['count'] += 1
body = bodies['III-DIF-374'][1]
(d8 / 'b' / 'III-DIF-49.json').write_text(json.dumps({'_meta': {'h': BA.body_hash({'III-DIF-999': body})}, 'III-DIF-999': body}, ensure_ascii=False), encoding='utf-8')
idx8['bodies']['chunks']['III-DIF-49'] = BA.body_hash({'III-DIF-999': body})
(d8 / 'index.json').write_text(json.dumps(idx8, ensure_ascii=False), encoding='utf-8')
r = CD.compare(DATA, d8)
ok(r['added'] == ['III-DIF-999'] and not r['broken'] and not r['changed'], '8. 問題が増えた')
r = CD.compare(d8, DATA)
ok(r['lost'] == ['III-DIF-999'], '9. 問題が消えた')
d10 = copy('miss')
(d10 / 'b' / 'III-DIF-18.json').unlink()
r = CD.compare(DATA, d10)
ok(not CD.report(r) and any('III-DIF-18.json: 一覧にある本文ファイルが無い' in x for x in r['broken']) and any('III-DIF-374: 本文が無い' in x for x in r['broken']),
   '10. 塊のファイルが無い：整合しないとして失敗（どの問題の本文が無いかも出す）')
d11 = copy('hash')
edit_body(d11, 'III-DIF-374', 'q', lambda v: v + 'X', rehash=False)
r = CD.compare(DATA, d11)
ok(not CD.report(r) and any('ハッシュ' in x for x in r['broken']), '11. 一覧のハッシュと中身が合わない：整合しないとして失敗')
d12 = copy('dup')
b12 = json.loads((d12 / 'b' / 'III-DIF-0.json').read_text(encoding='utf-8'))
b12['III-DIF-374'] = bodies['III-DIF-374'][1]
(d12 / 'b' / 'III-DIF-0.json').write_text(json.dumps(b12, ensure_ascii=False), encoding='utf-8')
r = CD.compare(DATA, d12)
ok(not CD.report(r) and any('III-DIF-374: 本文が2つのファイルにある' in x for x in r['broken']), '12. 同じ ID の本文が2つ：整合しないとして失敗')
# 旧形式の欠け（分野ファイルが無い）も
dlm = to_legacy(DATA, 'legacy-miss')
(dlm / 'f-III-16.json').unlink()
r = CD.compare(OLD, dlm)
ok(not CD.report(r) and any('本文が無い' in x for x in r['broken']), '旧形式でも分野ファイルの欠けを失敗にする')
# 塊の形なのに前の形のファイルが残っている
dmx = copy('mixed')
shutil.copy2(OLD / 'f-I-01.json', dmx / 'f-I-01.json')
_, _, e = BA.load_bodies_checked(dmx)
ok(any('前の形の本文ファイルが残っている' in x for x in e), '塊の形と前の形が混ざっていれば失敗')


# ---------- check_answers ----------
def ca(d):
    p = subprocess.run(['node', str(ROOT / 'tools' / 'check_answers.mjs'), str(d)], capture_output=True, text=True)
    return p.returncode, p.stdout


rc, out = ca(DATA)
ok(rc == 0 and f'本文 {len(bodies)}問を走査（一覧 {len(bodies)}問' in out, f'check_answers：新形式で全問を走査（{out.splitlines()[0] if out else ""}）')
rc, out = ca(OLD)
ok(rc == 0 and '本文ファイル 20個' in out, 'check_answers：旧形式でも全問を走査')
rc, out = ca(d10)
ok(rc == 1 and 'III-DIF-18.json が無い' in out, 'check_answers：塊が欠けていれば失敗（残りだけ見て成功にしない）')
rc, out = ca(dlm)
ok(rc == 1 and '本文が無い' in out, 'check_answers：旧形式で分野ファイルが欠けても失敗')
PIN = next(e['id'] for e in idx['problems'] if e.get('in'))   # 入力用の答えのある問題
dna = copy('noin')
edit_body(dna, PIN, None, lambda b: b.pop('in'))
rc, out = ca(dna)
ok(rc == 1 and f'{PIN}: 一覧では入力用の答えがあるのに，本文に無い' in out, 'check_answers：入力用の答えが本文から消えたら失敗')
dbad = copy('badin')
edit_body(dbad, PIN, 'in', lambda v: 'x=(((')
rc, out = ca(dbad)
ok(rc == 1 and PIN in out, 'check_answers：読めない入力用の答えを見つける')
rc, out = ca(d12)
ok(rc == 1 and '本文が2つのファイルにある' in out, 'check_answers：本文の重複を見つける')

# ---------- build_dist ----------
DIST = TMP / 'dist'
res = BD.build(DIST)
ok(res['problems'] == [], f'build_dist：今のデータで問題なし（{res["problems"][:3]}）')
nb = len(list((DIST / 'data' / 'b').glob('*.json')))
ok(nb == len(idx['bodies']['chunks']) and not list((DIST / 'data').glob('f-*.json')), f'dist に塊が全部（{nb}個）・前の形のファイルは無い')
ok(all((DIST / 'data' / 'b' / f.name).read_bytes() == f.read_bytes() for f in (DATA / 'b').glob('*.json')), 'dist の塊は data/ と同じバイト（ハッシュが保たれる）')
(DIST / 'data' / 'b' / 'III-DIF-18.json').unlink()
e = BD.check(DIST)['problems']
ok(any('III-DIF-18.json: 一覧にある本文ファイルが無い' in x for x in e), 'build_dist の検査：塊が欠けた dist を見つける')
shutil.copy2(DATA / 'b' / 'III-DIF-18.json', DIST / 'data' / 'b' / 'III-DIF-18.json')
shutil.copy2(OLD / 'f-I-01.json', DIST / 'data' / 'f-I-01.json')
e = BD.check(DIST)['problems']
ok(any('前の形の本文ファイルが残っている' in x for x in e), 'build_dist の検査：古い分野ファイルが残った dist を見つける')
(DIST / 'data' / 'f-I-01.json').unlink()
edit_body(DIST / 'data', 'III-DIF-374', 'q', lambda v: v + 'X', rehash=False)
e = BD.check(DIST)['problems']
ok(any('ハッシュ' in x for x in e), 'build_dist の検査：ハッシュの合わない塊を見つける')

# ---------- validate_new：data/ が欠けていれば既存との照合をせずに中止 ----------
new_item = TMP / 'new.json'
new_item.write_text(json.dumps([{'subject': '数I', 'field': '2次関数', 'level': 0, 'theme': 't', 'minutes': 5, 'q': '$1+1$ を計算せよ。',
                                 'answer': '$2$', 'solution': '$2$', 'idea': 'i', 'tags': '計算', 'input': '2'}], ensure_ascii=False), encoding='utf-8')
import os  # noqa: E402
p = subprocess.run([sys.executable, str(ROOT / 'tools' / 'validate_new.py'), str(new_item), str(TMP / 'vn')], capture_output=True, text=True,
                   env={**os.environ, 'LEMMA_DATA': str(d10)})
ok(p.returncode != 0 and '本文がそろっていない' in (p.stdout + p.stderr), 'validate_new：data/ の塊が欠けていれば中止する')

# ---------- 作り直しの安定性：content の並び順に依らず同じバイト ----------
c2 = TMP / 'content'
shutil.copytree(ROOT / 'content', c2)
pf = c2 / 'problems' / 'III-16.json'
L = json.loads(pf.read_text(encoding='utf-8'))
L.reverse()
pf.write_text(json.dumps(L, ensure_ascii=False), encoding='utf-8')
BA.build(c2, TMP / 'rebuilt')
same = all((TMP / 'rebuilt' / 'b' / f.name).read_bytes() == f.read_bytes() for f in (DATA / 'b').glob('*.json'))
ok(same and len(list((TMP / 'rebuilt' / 'b').glob('*.json'))) == len(list((DATA / 'b').glob('*.json'))), 'content の中の並び順を変えても，塊のファイルは1バイトも変わらない')

shutil.rmtree(TMP, ignore_errors=True)
print(f'監査ツールの異常系：{passed} 件合格' + (f'，{failed} 件失敗' if failed else ''))
sys.exit(1 if failed else 0)
