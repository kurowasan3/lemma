#!/usr/bin/env python3
"""問題管理表（.xlsx）→ 正規データ（content/problems/<分野ID>.json）

    python3 tools/xlsx_to_content.py Lemma問題管理表.xlsx [content フォルダ] [--new-fields]

- LaTeX は変換せずそのまま入れる（アプリ用 HTML は build_app_data.py が作る）。
- 分野ID は content/taxonomy.json で決める。表に無い分野があると止まる。
  --new-fields を付けると、無い分野を taxonomy.json の末尾に新しい ID で足してから続ける。
- 「参考元（非公開）」「メモ」は読まない（公開リポジトリに置くため）。「作成方法」も既定では入れない。
- タグに「非表示」を含む問題は quality.status = "hidden"（アプリには出ない）。
形式の詳細は docs/data-spec.md。
"""
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit('openpyxl が必要です： pip3 install openpyxl')

ROOT = Path(__file__).resolve().parent.parent
SUBJECT_KEY = {'数I': 'I', '数A': 'A', '数II': 'II', '数B': 'B', '数III': 'III', '数C': 'C', '融合': 'X'}
# 見出しの名前 → 内部の名前（列の順番が変わっても読めるように、見出しで探す）
HEADERS = {'ID': 'id', '作成日': 'date', '科目': 'subject', '分野': 'field', '単元・テーマ': 'theme', '難易度': 'level',
           '想定時間(分)': 'minutes', '問題文（LaTeX）': 'q', '答え': 'answer', '解答・解説': 'solution',
           '核となるアイデア': 'idea', '参考元（非公開）': 'source', '作成方法': 'method', '検証:二重解答': 'v1',
           '検証:SymPy等': 'v2', '検証:人間確認': 'v3', '検証済み': 'verified', 'タグ': 'tags', 'メモ': 'memo',
           '入力用の答え': 'input'}
PRIVATE = {'source', 'memo'}          # 決して書き出さない列
INCLUDE_METHOD = False                # 「作成方法」を公開データに入れるか（未決定のため入れない）
SCHEMA = 'lemma.problem/1'


class ImportFailure(Exception):
    pass


def read_sheet(src):
    """問題一覧の各行を {内部名: 値} にして返す（非公開の列は捨てる）。見出し行の次から。"""
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb['問題一覧']
    head = [str(c or '').strip() for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    cols = [HEADERS.get(h) for h in head]
    if 'id' not in cols or 'q' not in cols:
        raise ImportFailure('問題一覧シートの見出しに「ID」「問題文（LaTeX）」が見つかりません')
    recs = []
    for n, r in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not r or not r[0]:
            continue
        rec = {k: None for k in HEADERS.values() if k not in PRIVATE}
        rec.update({k: v for k, v in zip(cols, r) if k and k not in PRIVATE})
        rec['_row'] = n
        recs.append(rec)
    return recs


def split_tags(raw):
    return [t.strip() for t in re.split(r'[,、，]', str(raw or '')) if t.strip()]


def split_theme(theme):
    """「大きな単元／具体的なテーマ」→ (単元, テーマ)。区切りが無ければ (None, 全体)"""
    t = str(theme).strip()
    if '／' in t:
        unit, topic = t.split('／', 1)
        return unit.strip() or None, topic.strip() or None
    return None, t or None


def iso_date(v):
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    m = re.match(r'^\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})', str(v or ''))
    return f'{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}' if m else None


def nl(s):
    return str(s).replace('\r\n', '\n').replace('\r', '\n')


class Taxonomy:
    def __init__(self, path):
        self.path = path
        self.data = json.loads(path.read_text(encoding='utf-8'))
        self.by_name = {(f['subject'], f['name']): f for f in self.data['fields']}

    def key(self, subject, field):
        f = self.by_name.get((subject, field))
        return f['key'] if f else None

    def add(self, subject, field):
        """新しい分野を末尾に足す。ID は「科目記号-通し番号」で、これまでの最大の次。消した番号は再利用しない。"""
        used = [int(f['key'].rsplit('-', 1)[1]) for f in self.data['fields']] + self.data.get('retiredNumbers', [])
        key = f'{SUBJECT_KEY[subject]}-{max(used) + 1:02d}'
        f = {'key': key, 'subject': subject, 'name': field, 'idPrefix': None,
             'order': max(x['order'] for x in self.data['fields']) + 1}
        self.data['fields'].append(f)
        self.by_name[(subject, field)] = f
        return key

    def save(self):
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def to_problem(rec, key, issues):
    pid = str(rec['id']).strip()
    raw_tags = str(rec['tags'] or '')
    try:
        level = int(rec['level'])
        level_issue = None
    except (TypeError, ValueError):
        level, level_issue = 3, 'level-missing'      # 今までと同じく 3 にして、印を残す
    if level < 0 or level > 5:
        level, level_issue = min(5, max(0, level)), 'level-out-of-range'
    try:
        minutes = int(rec['minutes']) if rec['minutes'] else None
    except (TypeError, ValueError):
        minutes = None
    checks = {'dual': rec['v1'] == '済', 'sympy': rec['v2'] == '済', 'human': rec['v3'] == '済'}
    p = {'id': pid, 'schema': SCHEMA, 'kind': 'written', 'field': key, 'level': level}
    if minutes:
        p['minutes'] = minutes
    if rec['theme']:
        p['theme'] = str(rec['theme'])
        unit, topic = split_theme(rec['theme'])
        if unit:
            p['unit'] = unit
        if topic:
            p['topic'] = topic
    p['statement'] = {'tex': nl(rec['q'])}
    p['answer'] = {'tex': nl(rec['answer'])}
    p['solutions'] = [{'id': 'main', 'kind': 'main', 'tex': nl(rec['solution'] or '')}]
    if rec['idea']:
        p['idea'] = {'tex': nl(rec['idea'])}
    if rec['input'] and str(rec['input']).strip():
        p['grading'] = {'format': 'lemma-input/1', 'spec': str(rec['input']).strip().replace('\r\n', '\n')}
    p['methods'] = []
    p['tags'] = [t for t in split_tags(raw_tags) if t != '非表示']
    prov = {}
    created = iso_date(rec['date'])
    if created:
        prov['created'] = created
    elif rec['date']:
        issues.append('date-unreadable')
    if INCLUDE_METHOD and rec['method']:
        prov['method'] = str(rec['method'])
    p['provenance'] = prov
    q = {'status': 'hidden' if '非表示' in raw_tags else 'published', 'checks': checks,
         'verified': rec['verified'] == '✓' or all(checks.values())}
    if level_issue:
        issues.append(level_issue)
    if issues:
        q['issues'] = sorted(set(issues))
    p['quality'] = q
    return p


def convert(src, content=ROOT / 'content', new_fields=False):
    """Excel を読み、content/problems/*.json と content/meta.json を書く。戻り値：(問題数, 注意の一覧)"""
    src, content = Path(src), Path(content)
    tax = Taxonomy(content / 'taxonomy.json')
    recs = read_sheet(src)
    errors, notes, seen, out = [], [], set(), {}
    for rec in recs:
        pid = str(rec['id']).strip()
        where = f'{pid}（{rec["_row"]}行目）'
        if pid in seen:
            errors.append(f'{where}: ID が重複しています')
            continue
        seen.add(pid)
        subject, field = str(rec['subject'] or '').strip(), str(rec['field'] or '').strip()
        if subject not in SUBJECT_KEY:
            errors.append(f'{where}: 科目「{subject}」が不明です')
            continue
        if not rec['q'] or not rec['answer']:
            errors.append(f'{where}: 問題文か答えが空です')
            continue
        key = tax.key(subject, field)
        if key is None:
            if not new_fields:
                errors.append(f'{where}: 分野「{subject}／{field}」が content/taxonomy.json にありません'
                              '（新しい分野なら --new-fields を付けて実行）')
                continue
            key = tax.add(subject, field)
            notes.append(f'新しい分野を追加しました：{key} {subject}／{field}')
        issues = []
        out.setdefault(key, []).append(to_problem(rec, key, issues))
        if issues:
            notes.append(f'{where}: ' + ', '.join(issues))
    if errors:
        raise ImportFailure('\n'.join(errors))
    if new_fields:
        tax.save()
    pdir = content / 'problems'
    pdir.mkdir(parents=True, exist_ok=True)
    for old in pdir.glob('*.json'):
        if old.name != 'builtin.json':
            old.unlink()
    for key, items in out.items():
        (pdir / f'{key}.json').write_text(json.dumps(items, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    meta = {'schema': 'lemma.content-meta/1', 'source': src.name,
            'generated': datetime.fromtimestamp(src.stat().st_mtime).isoformat(timespec='seconds')}
    (content / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return sum(len(v) for v in out.values()), notes


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    try:
        n, notes = convert(args[0], args[1] if len(args) > 1 else ROOT / 'content', '--new-fields' in sys.argv)
    except ImportFailure as e:
        sys.exit(f'取り込みを中止しました：\n{e}')
    print(f'正規データ {n}問を書き出しました')
    for x in notes:
        print('  注意', x)


if __name__ == '__main__':
    main()
