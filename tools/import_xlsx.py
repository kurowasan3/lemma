#!/usr/bin/env python3
"""Lemma 問題管理表（.xlsx）→ 正規データ（content/）→ アプリ用データ（data/）

使い方：
    pip3 install openpyxl
    python3 tools/import_xlsx.py Lemma問題管理表.xlsx            取り込む（content/ と data/ を作り直す）
    python3 tools/import_xlsx.py Lemma問題管理表.xlsx --check    書き出さずに、今の content/・data/ と違うかだけ調べる
    python3 tools/import_xlsx.py Lemma問題管理表.xlsx --new-fields   表に無い分野を taxonomy.json に足してから取り込む
    python3 tools/import_xlsx.py Lemma問題管理表.xlsx 出力先 --legacy  v0.6 までの方法（Excel → data/ を直接）。戻すとき用

中で行うこと：
    1. tools/xlsx_to_content.py   Excel → content/problems/*.json（LaTeX のまま。分野ID は content/taxonomy.json）
    2. tools/builtin_to_content.mjs  js/content.js の内蔵問題 → content/problems/builtin.json（node があれば）
    3. tools/build_app_data.py    content/ → data/index.json と data/f-<分野>.json（アプリが読む形。今までと同じ）

「参考元」「作成方法」「メモ」は公開データに含めない。
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit('openpyxl が必要です： pip3 install openpyxl')

SUBJECT_KEY = {'数I': 'I', '数A': 'A', '数II': 'II', '数B': 'B', '数III': 'III', '数C': 'C', '融合': 'X'}
# 見出しの名前 → 内部の名前（列の順番が変わっても読めるように、見出しで探す）
HEADERS = {'ID': 'id', '作成日': 'date', '科目': 'subject', '分野': 'field', '単元・テーマ': 'theme', '難易度': 'level',
           '想定時間(分)': 'minutes', '問題文（LaTeX）': 'q', '答え': 'answer', '解答・解説': 'solution',
           '核となるアイデア': 'idea', '参考元（非公開）': 'source', '作成方法': 'method', '検証:二重解答': 'v1',
           '検証:SymPy等': 'v2', '検証:人間確認': 'v3', '検証済み': 'verified', 'タグ': 'tags', 'メモ': 'memo',
           '入力用の答え': 'input'}

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
sys.path.insert(0, str(TOOLS))
from latex_html import WARN, render  # noqa: E402,F401  （LaTeX → HTML。validate_new.py もここから使う）


# ---------------------------------------------------------------- 読み込み
def field_key(subject, field, keys):
    k = keys.get((subject, field))
    if not k:
        k = f'{SUBJECT_KEY.get(subject, "X")}-{len(keys) + 1:02d}'
        keys[(subject, field)] = k
    return k


def legacy(argv):
    """v0.6 までの取り込み（Excel → data/ を直接）。新しい経路と結果が同じことを確かめるため・戻すために残す"""
    if len(argv) < 2:
        sys.exit(__doc__)
    src = Path(argv[1])
    out = Path(argv[2]) if len(argv) > 2 else Path(__file__).resolve().parent.parent / 'data'
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb['問題一覧']
    head = [str(c or '').strip() for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    cols = [HEADERS.get(h) for h in head]
    if 'id' not in cols or 'q' not in cols:
        sys.exit('問題一覧シートの見出しに「ID」「問題文（LaTeX）」が見つかりません')
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    # 分野の並び順は「分野一覧」シートに従う
    order = []
    if '分野一覧' in wb.sheetnames:
        for r in wb['分野一覧'].iter_rows(min_row=2, values_only=True):
            if r[0] and r[1] and r[0] in SUBJECT_KEY:
                order.append((r[0], r[1]))
    keys = {}
    for sf in order:
        field_key(*sf, keys)

    index, bodies, seen, unknown, hidden = [], {}, set(), set(), 0
    for r in rows:
        if not r or not r[0]:
            continue
        rec = {k: None for k in HEADERS.values()}
        rec.update({k: v for k, v in zip(cols, r) if k})
        pid = str(rec['id']).strip()
        if pid in seen:
            WARN.append(f'{pid}: ID が重複しています（2件目以降は無視）')
            continue
        seen.add(pid)
        subject, field = str(rec['subject'] or '').strip(), str(rec['field'] or '').strip()
        if subject not in SUBJECT_KEY:
            WARN.append(f'{pid}: 科目「{subject}」が不明なので飛ばします')
            continue
        if not rec['q'] or not rec['answer']:
            WARN.append(f'{pid}: 問題文か答えが空なので飛ばします')
            continue
        tags_raw = str(rec['tags'] or '')
        if '非表示' in tags_raw:
            hidden += 1
            continue
        fk = field_key(subject, field, keys)
        ctx = {'id': pid, 'unknown': unknown}
        try:
            lv = int(rec['level'])
        except (TypeError, ValueError):
            lv = 3
            WARN.append(f'{pid}: 難易度が数でないので 3 にしました')
        lv = min(5, max(0, lv))   # 0=基礎 1=標準 2=2次基礎 3=国立2次 4=難関 5=最難関
        try:
            mins = int(rec['minutes']) if rec['minutes'] else None
        except (TypeError, ValueError):
            mins = None
        tags = [t.strip() for t in re.split(r'[,、，]', tags_raw) if t.strip()]
        entry = {'id': pid, 'f': fk, 'lv': lv}
        if mins:
            entry['t'] = mins
        if rec['theme']:
            entry['th'] = render(rec['theme'], ctx)
        if tags:
            entry['tg'] = tags
        if rec['verified'] == '✓' or (rec['v1'] == '済' and rec['v2'] == '済' and rec['v3'] == '済'):
            entry['ok'] = 1
        index.append(entry)
        bodies.setdefault(fk, {})[pid] = {
            'q': render(rec['q'], ctx),
            'a': render(rec['answer'], ctx),
            's': render(rec['solution'] or '', ctx),
            'k': render(rec['idea'] or '', ctx),
        }
        if rec['input'] and str(rec['input']).strip():
            bodies[fk][pid]['in'] = str(rec['input']).strip().replace('\r\n', '\n')
            entry['in'] = 1

    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('f-*.json'):
        old.unlink()
    fields = [{'key': k, 'subject': s, 'name': f} for (s, f), k in keys.items()
              if any(e['f'] == k for e in index)]
    meta = {'generated': datetime.fromtimestamp(src.stat().st_mtime).isoformat(timespec='seconds'), 'source': src.name,
            'count': len(index), 'fields': fields, 'problems': index}
    (out / 'index.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    for fk, b in bodies.items():
        (out / f'f-{fk}.json').write_text(json.dumps(b, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    print(f'{len(index)}問を書き出しました（{len(fields)}分野、入力して採点できる問題 {sum(1 for e in index if e.get("in"))}問、非表示 {hidden}問） → {out}')
    print('入力用の答えの検査： node tools/check_answers.mjs data')
    if unknown:
        print('文章中の未対応命令（名前だけ表示）:', ', '.join(sorted(unknown)))
    if WARN:
        print(f'注意 {len(WARN)}件:')
        for w in WARN[:50]:
            print('  ', w)


def run(src, content, data, new_fields=False):
    import xlsx_to_content as XC
    import build_app_data as BA
    n, notes = XC.convert(src, content, new_fields)
    node = shutil.which('node')
    if node:
        subprocess.run([node, str(TOOLS / 'builtin_to_content.mjs'), str(content)], check=True, capture_output=True)
    else:
        notes.append('node が無いので内蔵問題（builtin.json）は更新していません')
    import tags as TG
    _, added = TG.update(content)
    if added:
        notes.append(f'タグ辞書に新しいタグを {added}語 足しました（content/tags.json）')
    r = BA.build(content, data)
    return n, notes, r


def main():
    argv = [a for a in sys.argv if not a.startswith('--')]
    if '--legacy' in sys.argv:
        return legacy(argv)
    if len(argv) < 2:
        sys.exit(__doc__)
    src = Path(argv[1])
    data = Path(argv[2]) if len(argv) > 2 else ROOT / 'data'
    content = ROOT / 'content'
    import xlsx_to_content as XC
    import compare_data as CD
    try:
        if '--check' in sys.argv:
            with tempfile.TemporaryDirectory() as tmp:
                tc, td = Path(tmp) / 'content', Path(tmp) / 'data'
                shutil.copytree(content, tc)
                run(src, tc, td, '--new-fields' in sys.argv)
                same_content = all((tc / p.relative_to(content)).exists() and (tc / p.relative_to(content)).read_bytes() == p.read_bytes()
                                   for p in content.rglob('*.json')) and \
                    len(list(tc.rglob('*.json'))) == len(list(content.rglob('*.json')))
                print('content/：', '同じ' if same_content else '違いがあります')
                print('data/：', end='')
                ok = CD.report(CD.compare(data, td))
            sys.exit(0 if (ok and same_content) else 1)
        n, notes, r = run(src, content, data, '--new-fields' in sys.argv)
    except XC.ImportFailure as e:
        sys.exit(f'取り込みを中止しました（何も書き換えていません）：\n{e}')
    print(f'正規データ {n}問 → content/')
    print(f"{r['count']}問を書き出しました（{r['fields']}分野、入力して採点できる問題 {r['auto']}問、非表示 {r['hidden']}問、"
          f"dataVersion {r['dataVersion']}） → {data}")
    print('検査： node tests/run.mjs')
    for x in notes:
        print('  注意', x)
    if r['unknown']:
        print('文章中の未対応命令（名前だけ表示）:', ', '.join(r['unknown']))
    for w in r['warn'][:50]:
        print('  注意', w)


if __name__ == '__main__':
    main()
