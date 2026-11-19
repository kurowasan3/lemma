// 配信用の dist/ を、_headers のセキュリティヘッダー（CSP など）つきで配信して、アプリが動くかを確かめる（Playwright・Chromium）
//   node tests/e2e_dist.mjs
// CSP を厳しくしすぎてアプリが動かなくなる事故（グラフ・採点・KaTeX・同期の通信）を、公開前に見つけるため。
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'lemma-dist-'));
execFileSync(process.env.PYTHON || 'python3', [path.join(root, 'tools/build_dist.py'), dist], { stdio: 'pipe' });

// _headers（Cloudflare Pages の書式）を読んで、パスに合うヘッダーを付ける
const rules = [];
let cur = null;
for (const line of fs.readFileSync(path.join(dist, '_headers'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (!/^\s/.test(line)) { cur = { pat: line.trim(), h: {} }; rules.push(cur); continue; }
  const i = line.indexOf(':'); cur.h[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const match = (pat, p) => new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(p);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(dist, p);
  if (!f.startsWith(dist) || !fs.existsSync(f) || p.startsWith('/_headers')) { res.writeHead(404); return res.end(); }
  const h = { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' };
  for (const r of rules) if (match(r.pat, p)) Object.assign(h, r.h);
  res.writeHead(200, h);
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const U = `http://localhost:${server.address().port}/`;

let fail = 0, pass = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' || /Content Security Policy/.test(m.text())) errs.push(m.text()); });
  const resp = await page.goto(U + '#today');
  ok(/script-src 'self'/.test(resp.headers()['content-security-policy'] || ''), 'CSP ヘッダーが付いている');
  await page.waitForTimeout(1500);
  ok(await page.locator('#random').count() === 1, 'ホームが出る');
  // 入力式の採点（parser.js の compile）
  await page.evaluate("__lemma.open(['I-QF-109'])"); await page.waitForTimeout(1000);
  await page.locator('#conf button').nth(1).click();
  const inp = page.locator('#inputs input');
  await inp.nth(0).fill('x^2-8x+10'); await inp.nth(1).fill('4'); await inp.nth(2).fill('-3');
  await page.click('#judge'); await page.waitForTimeout(600);
  ok(await page.locator('.katex').count() > 0, 'KaTeX で数式が出る');
  ok(await page.locator('#inputs .is-ok, .banner.ok, .ok').count() > 0, '採点できる');
  // グラフ（式を関数にする）
  await page.goto(U + '#graph'); await page.waitForTimeout(1200);
  ok(await page.locator('canvas').count() > 0, 'グラフが描ける');
  // 配信してはいけないもの
  for (const p of ['content/meta.json', 'tools/build_app_data.py', 'tests/run.mjs', 'README.md', 'supabase/schema.sql']) {
    const r = await page.request.get(U + p);
    ok(r.status() === 404, `${p} は配信されない`);
  }
  ok((await (await page.request.get(U + 'robots.txt')).text()).includes('Disallow: /'), 'robots.txt で収集を断る');
  ok(errs.length === 0, `CSP 違反・エラーなし ${errs.join(' / ')}`);
} finally {
  await browser.close();
  server.close();
  fs.rmSync(dist, { recursive: true, force: true });
}
console.log(`dist: ${pass} 件 OK${fail ? `、${fail} 件失敗` : ''}`);
process.exitCode = fail ? 1 : 0;
