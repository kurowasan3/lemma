#!/usr/bin/env python3
"""配信用のフォルダ dist/ を作る（アプリが動くのに必要なファイルだけ）。

    python3 tools/build_dist.py            # dist/ を作り直す
    python3 tools/build_dist.py OUT        # 出力先を変える

リポジトリを非公開にしたあとは、GitHub Pages（リポジトリ全体が配信される）ではなく、
この dist/ だけを Cloudflare Pages などに置く。content/（正規データ）・tools/・tests/・docs/・supabase/ は配信しない。

入れるもの：index.html・privacy.html・terms.html・manifest.webmanifest・sw.js・css/・js/・vendor/・icons/・data/*.json
足すもの　：_headers（セキュリティヘッダー。Cloudflare Pages・Netlify の書式）・robots.txt（検索・収集ツールに読ませない）
確かめること：sw.js の FILES がすべて揃っている、data/index.json の分野ファイルがすべてある、配信してはいけないものが無い。
"""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['index.html', 'privacy.html', 'terms.html', 'manifest.webmanifest', 'sw.js']
DIRS = ['css', 'js', 'vendor', 'icons']
FORBIDDEN = ['content', 'tools', 'tests', 'docs', 'supabase', '.github', 'README.md']


def supabase_origin():
    m = re.search(r"SUPABASE_URL\s*=\s*'([^']*)'", (ROOT / 'js' / 'config.js').read_text(encoding='utf-8'))
    url = (m.group(1) if m else '').rstrip('/')
    return re.match(r'https://[^/]+', url).group(0) if url else ''


def headers_text():
    supa = supabase_origin()
    # script-src の 'unsafe-eval'：js/parser.js の compile() が new Function で式を関数にするため（グラフ・採点）。
    # style-src の 'unsafe-inline'：画面の HTML と KaTeX が style 属性を使うため。
    csp = '; '.join([
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        f"connect-src 'self' {supa}".strip(),
        "manifest-src 'self'",
        "worker-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ])
    return f"""/*
  Content-Security-Policy: {csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Robots-Tag: noindex, nofollow, noarchive

/sw.js
  Cache-Control: no-cache

/data/*
  Cache-Control: no-cache
"""


ROBOTS = """# Lemma のアプリ本体は検索・収集の対象にしない（利用規約 3. 禁止事項）
User-agent: *
Disallow: /
"""


def build(out):
    out = Path(out)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for f in PAGES:
        shutil.copy2(ROOT / f, out / f)
    for d in DIRS:
        shutil.copytree(ROOT / d, out / d, ignore=shutil.ignore_patterns('.*', '__pycache__'))
    (out / 'data').mkdir()
    for f in sorted((ROOT / 'data').glob('*.json')):
        shutil.copy2(f, out / 'data' / f.name)
    (out / '_headers').write_text(headers_text(), encoding='utf-8')
    (out / 'robots.txt').write_text(ROBOTS, encoding='utf-8')
    return check(out)


def check(out):
    out = Path(out)
    bad = []
    sw = (out / 'sw.js').read_text(encoding='utf-8')
    files = re.findall(r'"([^"]+)"', sw[sw.index('const FILES'):sw.index('];', sw.index('const FILES'))])
    for f in files:
        if f != './' and not (out / f).exists():
            bad.append(f'sw.js の FILES にある {f} が dist に無い')
    idx = json.loads((out / 'data' / 'index.json').read_text(encoding='utf-8'))
    for fld in {p['f'] for p in idx['problems']}:
        if not (out / 'data' / f'f-{fld}.json').exists():
            bad.append(f'data/f-{fld}.json が無い')
    for f in FORBIDDEN:
        if (out / f).exists():
            bad.append(f'配信してはいけない {f} が入っている')
    for p in out.rglob('*'):
        if p.suffix in ('.xlsx', '.py', '.pyc', '.mjs', '.cjs', '.sql', '.md'):
            bad.append(f'配信してはいけない種類のファイル {p.relative_to(out)}')
    if 'Content-Security-Policy' not in (out / '_headers').read_text(encoding='utf-8'):
        bad.append('_headers に CSP が無い')
    n = sum(1 for p in out.rglob('*') if p.is_file())
    size = sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
    return {'files': n, 'bytes': size, 'problems': bad}


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else ROOT / 'dist'
    r = build(out)
    for b in r['problems']:
        print('✗', b)
    print(f"dist：{r['files']}ファイル・{r['bytes'] / 1e6:.1f} MB → {out}")
    sys.exit(1 if r['problems'] else 0)
