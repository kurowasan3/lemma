#!/usr/bin/env python3
"""正規データ（content/）が JSON Schema（tools/schema/）に合っているか調べる。
    python3 tools/check_schema.py            （pip3 install jsonschema が必要）
問題があれば終了コード 1。"""
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit('jsonschema が必要です： pip3 install jsonschema')

ROOT = Path(__file__).resolve().parent.parent
S = ROOT / 'tools' / 'schema'
C = ROOT / 'content'


def validator(name):
    return Draft202012Validator(json.loads((S / f'{name}.schema.json').read_text(encoding='utf-8')))


def check(v, obj, where, errs):
    for e in v.iter_errors(obj):
        errs.append(f'{where} {"/".join(map(str, e.path))}: {e.message[:160]}')


def main():
    errs, n = [], 0
    check(validator('taxonomy'), json.loads((C / 'taxonomy.json').read_text(encoding='utf-8')), 'taxonomy.json', errs)
    check(validator('content-meta'), json.loads((C / 'meta.json').read_text(encoding='utf-8')), 'meta.json', errs)
    if (C / 'methods.json').exists():
        check(validator('methods'), json.loads((C / 'methods.json').read_text(encoding='utf-8')), 'methods.json', errs)
    if (C / 'tags.json').exists():
        check(validator('tags'), json.loads((C / 'tags.json').read_text(encoding='utf-8')), 'tags.json', errs)
    pv = validator('problem')
    for f in sorted((C / 'problems').glob('*.json')):
        for p in json.loads(f.read_text(encoding='utf-8')):
            n += 1
            check(pv, p, f'problems/{f.name} {p.get("id")}', errs)
    cv = validator('collection')
    for f in sorted((C / 'collections').glob('*.json')) if (C / 'collections').exists() else []:
        check(cv, json.loads(f.read_text(encoding='utf-8')), f'collections/{f.name}', errs)
    print(f'正規データ {n}問を検査、Schema に合わないもの {len(errs)}件')
    for e in errs[:40]:
        print(' ', e)
    sys.exit(1 if errs else 0)


if __name__ == '__main__':
    main()
