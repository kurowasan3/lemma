// 答えの図（管理表の「答えの図」列）を確かめる：アプリと同じグラフで描き，読めない式を報告し，PNG を書き出す
//   node tools/answer_figure_check.mjs 図.json 出力フォルダ
//   図.json：{ "問題ID": [ { "mode": "2d"|"complex"|"3d", "exprs": [式…], "view": [xmin, xmax, ymin, ymax], "note": "…", "title": "…" }, … ], … }
//   （content の answer_figures と同じ形。1つだけならオブジェクトでもよい）
//   出力フォルダに <問題ID>_<番号>.png と report.json（{ "問題ID_番号": { errors: [...], kinds: [...], params: [...] } }）を書く
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [inFile, outDir] = process.argv.slice(2);
if (!inFile || !outDir) { console.error('使い方：node tools/answer_figure_check.mjs 図.json 出力フォルダ'); process.exit(2); }
const specs = JSON.parse(fs.readFileSync(inFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 420 } });
const report = {};
let bad = 0;
const jobs = Object.entries(specs).flatMap(([pid, v]) => (Array.isArray(v) ? v : [v]).map((spec, i) => [`${pid}_${i + 1}`, spec]));
for (const [id, spec] of jobs) {
  const b64 = Buffer.from(JSON.stringify(spec), 'utf8').toString('base64');
  await page.goto(`http://localhost:${port}/tools/figure_preview.html?id=${encodeURIComponent(id)}#${b64}`);
  try { await page.waitForFunction(() => window.RESULT, null, { timeout: 8000 }); } catch (e) { report[id] = { errors: ['描画できませんでした（ページのエラー）'] }; bad++; continue; }
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => window.RESULT);
  const unknown = r.kinds.map((k, i) => k === null && !r.errors.some(e => e.startsWith(`${i + 1}行目`)) ? `${i + 1}行目「${spec.exprs[i]}」：描けない式` : null).filter(Boolean);
  r.errors.push(...unknown);
  report[id] = r;
  if (r.errors.length) bad++;
  await page.screenshot({ path: path.join(outDir, `${id}.png`) });
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1) + '\n');
await browser.close(); server.close();
console.log(`${Object.keys(specs).length}問・${jobs.length}枚を描きました。読めない式のある図：${bad}枚 → ${path.join(outDir, 'report.json')}`);
process.exit(bad ? 1 : 0);
