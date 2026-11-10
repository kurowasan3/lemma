// Lemma の検査をまとめて実行する（GitHub Actions でも同じものを実行）
//   node tests/run.mjs          データと単体テスト
//   node tests/run.mjs --e2e    ブラウザでの通し操作も（Playwright が必要）
// どれか1つでも失敗したら終了コード 1。
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const py = process.env.PYTHON || 'python3';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lemma-'));

const steps = [
  ['データの監査（ID の重複・消えた ID・一覧と本文の一致）', py, ['tools/audit_data.py']],
  ['正規データの Schema', py, ['tools/check_schema.py']],
  ['content/ から data/ を作り直すと同じになる', py, ['-c', `
import json, sys, subprocess
sys.path.insert(0, 'tools')
import build_app_data as BA, compare_data as CD
r = BA.build('content', ${JSON.stringify(path.join(tmp, 'data'))})
ok = CD.report(CD.compare('data', ${JSON.stringify(path.join(tmp, 'data'))}))
v = json.load(open('data/index.json')).get('dataVersion')
if v != r['dataVersion']:
    print('data/ の dataVersion', v, 'と content/ から作った', r['dataVersion'], 'が違う → python3 tools/build_app_data.py'); ok = False
sys.exit(0 if ok else 1)`]],
  ['内蔵問題の書き出し（builtin.json・methods.json）が js/content.js と同じ', 'node', ['-e', `
const { execFileSync } = require('child_process'); const fs = require('fs'); const p = require('path');
const t = ${JSON.stringify(path.join(tmp, 'content'))};
fs.mkdirSync(t, { recursive: true }); fs.copyFileSync('content/taxonomy.json', p.join(t, 'taxonomy.json'));
execFileSync('node', ['tools/builtin_to_content.mjs', t]);
let ok = true;
for (const f of ['problems/builtin.json', 'methods.json']) {
  if (fs.readFileSync(p.join(t, f), 'utf8') !== fs.readFileSync(p.join('content', f), 'utf8')) { console.log(f + ' が古い → node tools/builtin_to_content.mjs'); ok = false; }
}
process.exit(ok ? 0 : 1);`]],
  ['入力用の答え（読める・正解を入れると正解になる）', 'node', ['tools/check_answers.mjs', 'data']],
  ['すべての数式を KaTeX で描画できる', 'node', ['tools/check_katex.cjs']],
  ['自動採点の回帰テスト', 'node', ['tests/answer.test.mjs']],
  ['catalog.js の単体テスト（getProblem・v0.6 の学習記録）', 'node', ['tests/catalog.test.mjs']],
  ['同期の単体テスト（記録の合わせ方・にせ Supabase との通信）', 'node', ['tests/sync.test.mjs']],
];
if (process.argv.includes('--e2e')) steps.push(['ブラウザでの通し操作', 'node', ['tests/e2e.mjs']]);

let failed = 0;
for (const [name, cmd, args] of steps) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  const ok = r.status === 0;
  const out = ((r.stdout || '') + (r.stderr || '')).split('\n')
    .filter(l => l.trim() && !/No character metrics|UserWarning|warn\(msg\)/.test(l));
  console.log(`${ok ? '✓' : '✗'} ${name}（${((Date.now() - t0) / 1000).toFixed(1)}秒）`);
  if (!ok) {
    failed++;
    console.log(out.slice(-25).map(l => '    ' + l).join('\n') || `    ${r.error || '終了コード ' + r.status}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} 件失敗しました` : '\nすべて通りました');
process.exitCode = failed ? 1 : 0;
