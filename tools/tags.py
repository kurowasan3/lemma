#!/usr/bin/env python3
"""タグ辞書（content/tags.json）を作る・更新する。

    python3 tools/tags.py            content/problems/ のタグを集めて辞書を更新する（import_xlsx.py も自動で実行）

- 表記ゆれ（中黒・空白・全角半角、「最大値」と「最大」など）は機械的にまとめる。
- 同じ意味の言い換え（「帰納法」と「数学的帰納法」など）は SYNONYMS に書いたものをまとめる。
- 辞書にすでにある項目（人が直した別名を含む）は消さない。新しいタグだけ足す。
- 問題の正規データ（content/problems）のタグは Excel の表記のまま。アプリ用データを作るとき、辞書の正規名に置き換える。
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 正規名 ← 別名（最初に辞書を作るときの種。あとは content/tags.json を直接直してよい）
SYNONYMS = {
    '最大・最小': ['最大最小', '最大値', '最小値', '最大', '最小', '最大・最小値', '最大値・最小値'],
    'はさみうち': ['はさみうちの原理', '挟み撃ち', '挟みうち'],
    '数学的帰納法': ['帰納法'],
    '相加相乗平均': ['相加相乗', '相加平均・相乗平均'],
    'コーシー・シュワルツ': ['コーシーシュワルツ', 'コーシー・シュワルツの不等式'],
    'ド・モアブルの定理': ['ド・モアブル'],
    '部分分数分解': ['部分分数'],
    '鳩の巣原理': ['鳩の巣'],
    '微分可能性': ['微分可能'],
    '連続性': ['連続'],
    '区分求積': ['区分求積法'],
    'バウムクーヘン積分': ['バウムクーヘン'],
    '正射影': ['正射影ベクトル'],
    '包除原理': ['包除'],
    '1次独立': ['一次独立', '一次独立性', '線形独立'],
    '回転体': ['回転体の体積'],
}


def norm(t):
    """表記ゆれを除いた比較用の文字列"""
    t = unicodedata.normalize('NFKC', str(t)).lower()
    return re.sub(r'[・･\s、,／/()（）「」\-−ー~〜]', '', t)


def load(content=ROOT / 'content'):
    p = Path(content) / 'tags.json'
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else None


def raw_counts(content=ROOT / 'content'):
    c = Counter()
    for f in (Path(content) / 'problems').glob('*.json'):
        for p in json.loads(f.read_text(encoding='utf-8')):
            if p['quality']['status'] == 'published':
                c.update(p['tags'])
    return c


def canonical_map(d):
    """表記（正規名・別名）→ 正規名。比較は norm() で行う"""
    m = {}
    for t in d['tags']:
        for s in [t['name']] + t.get('aliases', []):
            m.setdefault(norm(s), t['name'])
    return m


def to_canonical(tag, cmap):
    return cmap.get(norm(tag), tag)


def update(content=ROOT / 'content'):
    """辞書を作る（無ければ）・新しいタグを足す。戻り値：(辞書, 足したタグの数)"""
    content = Path(content)
    counts = raw_counts(content)
    d = load(content)
    if d is None:
        d = {'schema': 'lemma.tags/1',
             'note': '正規名（name）と別名（aliases）。別名や表記ゆれのタグは、アプリでは正規名で表示・検索される。'
                     'このファイルは手で直してよい（tools/tags.py は既存の項目を消さない）。count は自動で更新される。',
             'tags': [{'name': k, 'aliases': v} for k, v in SYNONYMS.items()]}
    cmap = canonical_map(d)
    by_name = {t['name']: t for t in d['tags']}
    added = 0
    # 表記ゆれでまとまるタグは、いちばん多い表記を正規名にする
    groups = {}
    for tag, n in counts.items():
        if norm(tag) in cmap:
            continue
        groups.setdefault(norm(tag), []).append((n, tag))
    for key, forms in groups.items():
        forms.sort(key=lambda x: (-x[0], x[1]))
        name = forms[0][1]
        t = {'name': name}
        if len(forms) > 1:
            t['aliases'] = [f for _, f in forms[1:]]
        d['tags'].append(t)
        by_name[name] = t
        cmap[key] = name
        added += 1
    # 別名が辞書の正規名と同じ表記になってしまわないよう、件数を数え直す
    total = Counter()
    for tag, n in counts.items():
        total[to_canonical(tag, cmap)] += n
    for t in d['tags']:
        t['count'] = total.get(t['name'], 0)
    d['tags'].sort(key=lambda t: (-t['count'], t['name']))
    (content / 'tags.json').write_text(json.dumps(d, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return d, added


if __name__ == '__main__':
    d, added = update(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'content')
    merged = sum(1 for t in d['tags'] if t.get('aliases'))
    print(f'タグ辞書：{len(d["tags"])}語（別名つき {merged}語、今回追加 {added}語） → content/tags.json')
