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
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_app_data import NO_MAIN, NO_SUPPORT  # noqa: E402

HEADERS = {'ID': 'id', '作成日': 'date', '科目': 'subject', '分野': 'field', '単元・テーマ': 'theme', '難易度': 'level',
           '想定時間(分)': 'minutes', '問題文（LaTeX）': 'q', '答え': 'answer', '解答・解説': 'solution',
           '核となるアイデア': 'idea', '参考元（非公開）': 'source', '作成方法': 'method', '検証:二重解答': 'v1',
           '検証:SymPy等': 'v2', '検証:人間確認': 'v3', '検証済み': 'verified', 'タグ': 'tags', 'メモ': 'memo',
           '入力用の答え': 'input', '図の式': 'figure', '答えの図': 'answer_figures', '頻出度': 'value', '教育的価値': 'value',
           '主な解法': 'technique_main', '補助の解法': 'technique_support', '解法': 'legacy_techniques'}
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
    have = {c for c in cols if c}
    recs = []
    for n, r in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not r or not r[0]:
            continue
        rec = {k: None for k in HEADERS.values() if k not in PRIVATE}
        rec.update({k: v for k, v in zip(cols, r) if k and k not in PRIVATE})
        rec['_row'] = n
        rec['_cols'] = have
        recs.append(rec)
    return recs


# 解法の列。正式な列は「主な解法」「補助の解法」の2つ（v0.29.0〜）。
#   どちらも空欄          … 未指定（タグから自動）
#   「主な解法」          … 解法カードの名前か ID を1つ、または「主な解法なし」（明示の主なし）
#   「補助の解法」        … 名前か ID を読点区切り（書いた順を保つ）、または「補助の解法なし」（明示の補助なし）
#   片方だけ空欄          … 誤り（未指定と明示の「なし」を混ぜない。取り込みを止める）
# 旧「解法」列（v0.28.x の1列：先頭が主、残りが補助）は v0.29.1 から読まない。列があれば取り込み全体を止める
#   （黙って読み飛ばすと、その列の指定が消えるため）。旧形式の管理表は tools/xlsx_technique_columns.py で
#   新しい2列の管理表に変換してから取り込む。
LEGACY_MSG = ('旧「解法」列は v0.29.1 から読みません。python3 tools/xlsx_technique_columns.py 元.xlsx 新.xlsx で'
              '「主な解法」「補助の解法」の2列に変換してから取り込んでください（元のファイルは上書きしません）')


def parse_techniques(rec):
    """戻り値：(項目の dict（未指定なら空）, 誤りの一覧)"""
    cols = rec['_cols']
    new_cols = {'technique_main', 'technique_support'} & cols
    if new_cols and len(new_cols) == 1:
        return {}, ['「主な解法」「補助の解法」の列は2つそろえて置く']
    if new_cols:
        m = str(rec.get('technique_main') or '').strip()
        sup = str(rec.get('technique_support') or '').strip()
        if not m and not sup:
            return {}, []
        if not m or not sup:
            return {}, ['「主な解法」「補助の解法」の片方だけが空欄（未指定なら両方空欄、なしなら「主な解法なし」「補助の解法なし」と書く）']
        errs = []
        ms = split_tags(m)
        if len(ms) != 1:
            errs.append(f'「主な解法」は1つだけ書く：{m}')
        main = None if ms == [NO_MAIN] else (ms[0] if ms else None)
        if main == NO_SUPPORT:
            errs.append('「主な解法」に「補助の解法なし」は書けない')
        sp = split_tags(sup)
        if sp == [NO_SUPPORT]:
            sp = []
        elif NO_SUPPORT in sp or NO_MAIN in sp:
            errs.append(f'「補助の解法」の予約語は単独で書く（「主な解法なし」は書けない）：{sup}')
        return {'technique_main': main, 'technique_support': sp}, errs
    return {}, []


FIG_MODES = {'平面': '2d', '2d': '2d', '2D': '2d', '複素平面': 'complex', '複素数平面': 'complex', 'complex': 'complex', 'ベクトル': '2d', 'vector': '2d',
             '空間': '3d', '3d': '3d', '3D': '3d'}


def parse_figure(raw):
    """「図の式」列：1行に1つの式。先頭に「モード：平面／空間／複素数平面」（ベクトルは平面・空間にそのまま書ける）（省略すると平面）、
    「表示：答え合わせのあと／最初から」（省略すると、問題文が「図示せよ」などなら答え合わせのあと）を書ける"""
    if raw is None or not str(raw).strip():
        return None
    mode, after, exprs = '2d', None, []
    for line in str(raw).replace('\r\n', '\n').split('\n'):
        t = line.strip()
        if not t:
            continue
        m = re.match(r'^(?:モード|mode)\s*[:：]\s*(.+)$', t)
        if m:
            key = m.group(1).strip()
            if key not in FIG_MODES:
                raise ImportFailure(f'「図の式」のモード「{key}」は使えません（平面・空間・複素数平面）')
            mode = FIG_MODES[key]
            continue
        m = re.match(r'^(?:表示|show)\s*[:：]\s*(.+)$', t)
        if m:
            v = m.group(1)
            after = not ('最初' in v or 'はじめ' in v or 'first' in v)   # 「答え合わせのあと」「後」なら true
            continue
        exprs.append(t)
    if not exprs:
        return None
    return {'mode': mode, 'exprs': exprs, 'after': after}


def parse_answer_figures(raw):
    """「答えの図」列：解説の中に描く答えの図（図示せよ・軌跡・領域など）。1行に1つの式。図が2つ以上なら「---」の行で区切る。
    各図の先頭に次の行を書ける。
      見出し：(2) の領域 D（図の上に出す。省略すると「答えの図」）
      モード：平面／複素数平面／空間（省略すると平面）
      範囲：x -3..3, y -2..4（表示する範囲。省略するとアプリの既定）
      縦横比：自由（縦と横の縮尺を別にして，範囲をちょうど画面に合わせる。細長い図形のとき。省略すると縦横同じ）
      説明：図の下に添える一言（境界を含むか など。$…$ の数式も書ける）"""
    if raw is None or not str(raw).strip():
        return None
    figs = []
    for block in re.split(r'\n\s*-{3,}\s*(?:\n|$)', str(raw).replace('\r\n', '\n')):
        mode, view, note, title, free, exprs = '2d', None, None, None, False, []
        for line in block.split('\n'):
            t = line.strip()
            if not t:
                continue
            m = re.match(r'^(?:見出し|title)\s*[:：]\s*(.+)$', t)
            if m:
                title = m.group(1).strip()
                continue
            m = re.match(r'^(?:モード|mode)\s*[:：]\s*(.+)$', t)
            if m:
                key = m.group(1).strip()
                if key not in FIG_MODES:
                    raise ImportFailure(f'「答えの図」のモード「{key}」は使えません（平面・空間・複素数平面）')
                mode = FIG_MODES[key]
                continue
            m = re.match(r'^(?:範囲|view)\s*[:：]\s*(.+)$', t)
            if m:
                num = r'(-?\d+(?:\.\d+)?)'
                mx = re.search(r'x\s*[:：]?\s*' + num + r'\s*\.\.\s*' + num, m.group(1))
                my = re.search(r'y\s*[:：]?\s*' + num + r'\s*\.\.\s*' + num, m.group(1))
                if not (mx and my) or float(mx.group(1)) >= float(mx.group(2)) or float(my.group(1)) >= float(my.group(2)):
                    raise ImportFailure(f'「答えの図」の範囲「{m.group(1)}」が読めません（例：範囲：x -3..3, y -2..4）')
                view = [float(mx.group(1)), float(mx.group(2)), float(my.group(1)), float(my.group(2))]
                continue
            m = re.match(r'^(?:縦横比|aspect)\s*[:：]\s*(.+)$', t)
            if m:
                free = m.group(1).strip() in ('自由', 'free')
                continue
            m = re.match(r'^(?:説明|note)\s*[:：]\s*(.+)$', t)
            if m:
                note = m.group(1).strip()
                continue
            exprs.append(t)
        if not exprs:
            continue
        fig = {'mode': mode, 'exprs': exprs}
        if title:
            fig['title'] = title
        if view:
            fig['view'] = [int(v) if v == int(v) else v for v in view]
            if free:
                fig['free_aspect'] = True
        if note:
            fig['note'] = note
        figs.append(fig)
    return figs or None


VALUE_WORDS = {'1': 1, '2': 2, '3': 3, '低': 1, '中': 2, '高': 3, '★': 1, '★★': 2, '★★★': 3}


def parse_value(raw):
    """「頻出度」列（旧名「教育的価値」も読む）：1〜3（または 低・中・高、★〜★★★）。空欄は None（自動判定を使う）"""
    if raw is None or str(raw).strip() == '':
        return None
    key = str(raw).strip().replace('.0', '')
    if key not in VALUE_WORDS:
        raise ImportFailure(f'「頻出度」は 1〜3（または 低・中・高）で書いてください：{raw}')
    return VALUE_WORDS[key]


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
    fig = parse_figure(rec.get('figure'))
    if fig:
        p['figure'] = fig
    afigs = parse_answer_figures(rec.get('answer_figures'))
    if afigs:
        p['answer_figures'] = afigs
    val = parse_value(rec.get('value'))
    if val:
        p['value'] = val
    p.update(rec.get('_tech') or {})   # technique_main・technique_support（parse_techniques。名前の照合は build_app_data.py）
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
    if recs and 'legacy_techniques' in recs[0]['_cols']:
        raise ImportFailure(LEGACY_MSG)
    if recs and not {'technique_main', 'technique_support'} & recs[0]['_cols']:
        # 解法の列が無い管理表で取り込むと、content の明示の指定がすべて消える。あれば止める
        have = sorted(p['id'] for f in (content / 'problems').glob('*.json') if f.name != 'builtin.json'
                      for p in json.loads(f.read_text(encoding='utf-8')) if 'technique_main' in p or 'technique_support' in p)
        if have:
            raise ImportFailure(f'管理表に「主な解法」「補助の解法」の列がありません。取り込むと content の明示の指定 {len(have)}問'
                                f'（{"・".join(have[:5])}{" など" if len(have) > 5 else ""}）が消えるので止めました。'
                                '列のある管理表（tools/xlsx_technique_columns.py で作れます）で取り込んでください')
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
        tech, terrs = parse_techniques(rec)
        if terrs:
            errors += [f'{where}: {x}' for x in terrs]
            continue
        rec['_tech'] = tech
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
