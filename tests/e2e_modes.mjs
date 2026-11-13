// 解答の形式（設定）を切り替えて、記述式・選択式・自己採点の画面と記録を確かめる（Playwright・Chromium）
//   node tests/e2e_modes.mjs [問題ID]      SHOTS=フォルダ を付けるとスクリーンショットを保存
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.env.SHOTS || null;
const SHOT = !!out;
let failed = 0;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webmanifest':'application/manifest+json', '.png':'image/png' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(8766, r));
const U = 'http://localhost:8766/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
const ok = (c, m) => { if (!c) { failed++; console.log('✗', m); } };
await page.goto(U + '#settings'); await page.waitForTimeout(1200);
ok(await page.locator('#amode button').count() === 3, '設定に3つの形式');
ok((await page.locator('#amode button.on').innerText()) === '記述式', '既定は記述式');
await page.locator('#amode button[data-m="choice"]').click(); await page.waitForTimeout(300);
SHOT && await page.screenshot({ path: out + '/1-settings.png' });
const ID = process.argv[2] || 'II-TRI-018';
await page.goto(U + '#ids=' + ID); await page.waitForTimeout(1500);
const nOpts = await page.locator('#inputs .choice').count();
ok(nOpts >= 8, `選択式：選択肢ボタン ${nOpts}個`);
ok((await page.locator('.chip').allInnerTexts()).includes('選択式'), 'チップが選択式');
SHOT && await page.screenshot({ path: out + '/2-choice.png', fullPage: true });
// 各欄で：最初の欄は正解、他は最初のボタン
const keys = [...new Set(await page.locator('#inputs .choice').evaluateAll(bs => bs.map(x => x.dataset.k)))];
for (const [j, k] of keys.entries()) {
  const sel = j === 0 ? `#inputs .choice[data-k="${k}"][data-i="0"]` : `#inputs .choice[data-k="${k}"][data-i="1"]`;
  await page.click(sel);
}
for (const inp of await page.locator('#inputs input').all()) await inp.fill('1');
await page.locator('#conf button').nth(1).click();
await page.click('#judge'); await page.waitForTimeout(600);
ok(await page.locator('#inputs .choice.right').count() === keys.length, '判定後：正解の選択肢に印');
ok(await page.locator('#inputs .choice.wrong').count() === keys.length - 1, '判定後：選んだ誤答に印');
ok(await page.locator('#judge').count() === 0, '選択式はやり直しなし');
ok(await page.locator('.dispute').count() === 0 || await page.locator('#inputs input').count() > 0, '選択欄に「判定がおかしい？」は出ない');
SHOT && await page.screenshot({ path: out + '/3-choice-judged.png', fullPage: true });
if (await page.locator('#self button').count()) await page.locator('#self button').first().click();
// 自己採点
await page.goto(U + '#settings'); await page.waitForTimeout(600);
await page.locator('#amode button[data-m="self"]').click(); await page.waitForTimeout(200);
await page.goto(U + '#ids=' + ID); await page.waitForTimeout(1500);
ok(await page.locator('#inputs').count() === 0 && await page.locator('.pen').count() === 1, '自己採点：入力欄なし');
await page.locator('#conf button').nth(1).click(); await page.click('#reveal'); await page.waitForTimeout(400);
ok(await page.locator('#self button').count() === 3, '自己採点のボタン');
SHOT && await page.screenshot({ path: out + '/4-self.png' });
await page.locator('#self button').nth(1).click(); await page.waitForTimeout(200);
// 記述式
await page.goto(U + '#settings'); await page.waitForTimeout(600);
await page.locator('#amode button[data-m="input"]').click(); await page.waitForTimeout(200);
await page.goto(U + '#ids=' + ID); await page.waitForTimeout(1500);
ok(await page.locator('#inputs input').count() > 0 && await page.locator('#inputs .choice').count() === 0, '記述式：入力欄');
SHOT && await page.screenshot({ path: out + '/5-input.png' });
const log = await page.evaluate(() => JSON.parse(localStorage.getItem('lemma.v2') || '{}').log?.map(l => l.md));
ok(JSON.stringify(log) === '["choice","self"]', '記録に形式が残る ' + JSON.stringify(log));
ok(!errs.length, 'エラーなし ' + errs.join(' / '));
await b.close(); srv.close();
console.log(failed ? `解答の形式：${failed} 件失敗` : '解答の形式：OK');
process.exit(failed ? 1 : 0);
